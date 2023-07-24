import { useCallback, useEffect, useState } from 'react';
import { RevenoteFile } from '@renderer/types/file';
import { ExcalidrawApp } from 'handraw-materials';
import {
  ExcalidrawDataSource,
  NonDeletedExcalidrawElement
} from 'handraw-materials/es/ExcalidrawApp/types';
import { canvasIndexeddbStorage } from '@renderer/store/canvasIndexeddb';
import { useDebounceFn } from 'ahooks';

interface Props {
  file: RevenoteFile;
}

const DEFAULT_DATA_SOURCE = '{}';

export default function Handraw({ file }: Props) {
  const [dataSource, setDataSource] = useState<string>();

  const getDataSource = useCallback(async (id) => {
    const data = await canvasIndexeddbStorage.getCanvas(id);

    console.log('getDataSource', data);

    setDataSource(data || DEFAULT_DATA_SOURCE);
  }, []);

  const onChangeFn = useCallback(async (data) => {
    console.log('--- onchange ---', data);

    const str = JSON.stringify(data);

    await canvasIndexeddbStorage.addOrUpdateCanvas(file.id, str);
  }, []);

  const { run: onChangeDebounceFn } = useDebounceFn(onChangeFn, { wait: 200 });

  useEffect(() => {
    getDataSource(file.id);
  }, [file.id]);

  return dataSource ? (
    <ExcalidrawApp dataSource={dataSource} canvasName={file.name} onChange={onChangeDebounceFn} />
  ) : null;
}