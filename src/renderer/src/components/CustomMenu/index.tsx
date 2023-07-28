import { useCallback, useEffect, useState } from 'react';
import { Menu, Dropdown } from 'antd';
import { FolderIcon, TrashIcon } from '@heroicons/react/24/outline';
import { menuIndexeddbStorage } from '@renderer/store/menuIndexeddb';
import type { RevenoteFile, RevenoteFolder } from '@renderer/types/file';
import {
  getOpenKeysFromLocal,
  getSelectedKeysFromLocal,
  setCurrentFileIdToLocal,
  setOpenKeysToLocal,
  setSelectedKeysToLocal
} from '@renderer/store/localstorage';
import { useAtom } from 'jotai';
import {
  currentFileIdAtom,
  currentFileAtom,
  fileTreeAtom,
  currentFolderIdAtom
} from '@renderer/store/jotai';
import EditableText from '../EditableText';
import { blocksuiteStorage } from '@renderer/store/blocksuite';
import useBlocksuitePageTitle from '@renderer/hooks/useBlocksuitePageTitle';
import { useDebounceEffect } from 'ahooks';
import { FILE_ID_REGEX } from '@renderer/utils/constant';
import AddFile from '../AddFile';
import { FolderPlus } from 'lucide-react';
import moment from 'moment';

import './index.css';
import { getCurrentFolderIdByFileId } from '@renderer/utils/menu';

interface Props {
  collapsed: boolean;
}

const getFileMenuKey = (id, name) => `${id}______${name}`;

export default function CustomMenu({ collapsed }: Props) {
  const [openKeys, setOpenKeys] = useState<string[]>(getOpenKeysFromLocal());
  const [selectedKeys, setSelectedKeys] = useState<string[]>(getSelectedKeysFromLocal());
  const [currentFileId, setCurrentFileId] = useAtom(currentFileIdAtom);
  const [, setCurrentFile] = useAtom(currentFileAtom);
  const [pageTitle] = useBlocksuitePageTitle();
  const [fileTree, setFileTree] = useAtom(fileTreeAtom);
  const [currentFolderId, setCurrentFolderId] = useAtom(currentFolderIdAtom);

  const getFileTree = useCallback(async () => {
    const tree = await menuIndexeddbStorage.getFileTree();
    setFileTree(tree);
    return tree;
  }, []);

  useEffect(() => {
    !collapsed && getFileTree();
  }, [menuIndexeddbStorage, collapsed]);

  useEffect(() => {
    setSelectedKeysToLocal(selectedKeys);
  }, [selectedKeys]);

  useEffect(() => {
    const files = fileTree.reduce(
      (prev: RevenoteFile[], current) => [...prev, ...current.children],
      []
    );

    const file = currentFileId ? files?.find((_file) => _file.id === currentFileId) : null;

    setCurrentFile(file);
  }, [currentFileId, fileTree]);

  useEffect(() => {
    setCurrentFileIdToLocal(currentFileId);
  }, [currentFileId]);

  useEffect(() => {
    if (!currentFileId) {
      return;
    }
    const folderId = getCurrentFolderIdByFileId(currentFileId, fileTree);
    setCurrentFolderId(folderId);
  }, [currentFileId, fileTree]);

  const refreshMenu = useCallback(async () => {
    await getFileTree();
  }, [pageTitle]);

  useDebounceEffect(
    () => {
      refreshMenu();
    },
    [pageTitle],
    {
      wait: 200
    }
  );

  const addSelectedKeys = useCallback(
    (keys: string[] | undefined) => {
      if (!keys) return;

      let newKeys = selectedKeys;

      keys.forEach((key: string) => {
        const type = key?.startsWith('folder_') ? 'folder' : 'file';

        newKeys = type ? newKeys.filter((_key) => !_key?.startsWith(type)) : newKeys;
      });

      newKeys = Array.from(new Set([...newKeys, ...keys])).filter((_key) => !!_key);

      setSelectedKeys(newKeys);
    },
    [selectedKeys]
  );

  const addFolder = useCallback(async () => {
    const folder = await menuIndexeddbStorage.addFolder();
    const tree = await menuIndexeddbStorage.getFileTree();
    setFileTree(tree);
    setCurrentFolderId(folder.id);
    setCurrentFileId(undefined);
    setCurrentFile(undefined);
    setOpenKeys([...openKeys, folder.id]);
    addSelectedKeys([folder.id]);
  }, []);

  const onFileAdd = useCallback(
    (fileId: string, folderId: string) => {
      setOpenKeys([...openKeys, folderId]);
      addSelectedKeys([getFileMenuKey(fileId, 'Untitled')]);
    },
    [openKeys]
  );

  const deleteFile = useCallback(
    async (fileId: string, folderId: string) => {
      await menuIndexeddbStorage.deleteFile(fileId);
      await blocksuiteStorage.deletePage(fileId);

      const tree = await getFileTree();

      // reset current file when current file is removed
      if (currentFileId === fileId) {
        const filesInFolder = tree.find((folder) => folder.id === folderId)?.children;

        setCurrentFileId(filesInFolder?.[0]?.id);
      }
    },
    [menuIndexeddbStorage]
  );

  const deleteFolder = useCallback(
    async (folderId: string) => {
      await menuIndexeddbStorage.deleteFolder(folderId);
      await getFileTree();
    },
    [menuIndexeddbStorage]
  );

  const resetMenu = useCallback(() => {
    setCurrentFileId(undefined);
    setCurrentFile(undefined);
    setCurrentFolderId(undefined);
    setSelectedKeys([]);
  }, []);

  const onOpenChange = useCallback(
    (keys) => {
      const changeType = keys?.length > openKeys.length ? 'increase' : 'decrease';

      setOpenKeys(keys);
      setOpenKeysToLocal(keys);

      // only while openKeys increase
      if (changeType === 'increase') {
        const folderId = keys?.length ? keys[keys.length - 1] : undefined;

        resetMenu();

        setCurrentFolderId(folderId);
        setSelectedKeys([folderId]);
      }
    },
    [openKeys]
  );

  const onSelect = useCallback(
    ({ key }) => {
      const fileId = key?.match(FILE_ID_REGEX)?.[1];

      if (!fileId) return;

      const folderId = getCurrentFolderIdByFileId(fileId, fileTree);

      resetMenu();

      setCurrentFileId(fileId);
      setCurrentFolderId(folderId);
      addSelectedKeys([key, folderId]);
    },
    [fileTree]
  );

  const getFolderMenu = useCallback(
    (folder: RevenoteFolder) => [
      {
        key: 'rename',
        label: 'rename',
        onClick: () => {
          console.log('rename');
        }
      },
      {
        key: 'delete',
        label: 'delete',
        onClick: ({ domEvent }) => {
          domEvent.stopPropagation();
          deleteFolder(folder.id);
        }
      }
    ],
    []
  );

  const getFileMenu = useCallback(
    (file, folder) => [
      {
        key: 'rename',
        label: 'rename',
        onClick: () => {
          console.log('rename');
        }
      },
      {
        key: 'delete',
        label: (
          <div className="flex items-center justify-between">
            <TrashIcon className="h-4 w-4" />
            <span className="ml-2">Delete</span>
          </div>
        ),
        onClick: () => {
          console.log('delete');
          deleteFile(file.id, folder.id);
        }
      },
      {
        key: 'copy_revenote_link',
        label: 'Copy Revenote Link',
        onClick: ({ domEvent }) => {
          domEvent.stopPropagation();
          navigator.clipboard.writeText(file.id);
        }
      }
    ],
    []
  );

  const onFileNameChange = useCallback((text: string, file: RevenoteFile) => {
    if (file.type === 'note') {
      blocksuiteStorage.updatePageTitle(file.id, text);
    }

    menuIndexeddbStorage.updateFileName(file, text);
  }, []);

  const onFolderNameChange = useCallback((folder: RevenoteFolder, text: string) => {
    menuIndexeddbStorage.updateFolderName(folder, text);
  }, []);

  return (
    <div className="revenote-menu-container">
      <div
        className="flex items-center pl-5 h-10 text-xl font-mono underline font-semibold tracking-wider
        bg-clip-text text-transparent text-sky-500 bg-gradient-to-r from-sky-300 to-sky-600 decoration-cyan-100
        underline-offset-2"
      >
        ReveNote
      </div>
      <div className="revenote-menu-toolbar flex items-center pl-5 h-10">
        <span title="Add a folder">
          <FolderPlus className="h-4 w-4 text-current cursor-pointer mr-5" onClick={addFolder} />
        </span>
        <AddFile size="small" folderId={currentFolderId} onAdd={onFileAdd} />
      </div>
      <Menu
        theme="light"
        mode="inline"
        selectedKeys={selectedKeys}
        openKeys={openKeys}
        onOpenChange={onOpenChange}
        onSelect={onSelect}
        style={{ border: 'none' }}
        items={fileTree?.map((folder) => ({
          key: folder.id,
          icon: <FolderIcon className="h-4 w-4" />,
          label: (
            <Dropdown menu={{ items: getFolderMenu(folder) }} trigger={['contextMenu']}>
              <div className="flex items-center justify-between">
                <EditableText
                  text={folder.name}
                  defaultText="Untitled"
                  onChange={(text) => onFolderNameChange(folder, text)}
                />
              </div>
            </Dropdown>
          ),
          children: folder?.children?.map((file) => {
            return {
              key: getFileMenuKey(file.id, file.name),
              label: (
                <Dropdown menu={{ items: getFileMenu(file, folder) }} trigger={['contextMenu']}>
                  <div className="flex items-center justify-between">
                    <EditableText
                      type={file.type}
                      text={file.name}
                      extraText={moment(file.gmtModified).format('YYYY-MM-DD HH:mm:ss')}
                      defaultText="Untitled"
                      onChange={(text) => onFileNameChange(text, file)}
                    />
                  </div>
                </Dropdown>
              )
            };
          })
        }))}
      />
    </div>
  );
}
