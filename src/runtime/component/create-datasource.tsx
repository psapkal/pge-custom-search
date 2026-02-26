/** @jsx jsx */
import { jsx, DataSourceComponent, Immutable, type ImmutableArray, type DataSourceStatus } from 'jimu-core'
import { type IMConfig, type IMServiceList, type IMServiceListItem, SearchServiceType, type IMDatasourceCreatedStatus } from '../../config'
import { getLocalId } from '../utils/utils'
import { getQueryByServiceListItem, loadDsRecords } from '../utils/search-service'
import { loadGeocodeOutputRecords } from '../utils/locator-service'
interface CreateDatasourceProps {
  id: string
  config: IMConfig
  serviceList: IMServiceList
  dsStatus: IMDatasourceCreatedStatus
  handleSearchResultChange: (configId: string, newRecords: string[]) => void
  handleSelectionListChange: (selection: ImmutableArray<string>, configId: string) => void
  handleDsStatusChange: (dsStatus: IMDatasourceCreatedStatus) => void
}

const CreateDatasource = (props: CreateDatasourceProps) => {
  const { config, id, serviceList, dsStatus, handleSearchResultChange, handleSelectionListChange, handleDsStatusChange } = props

  const renderDatasourceComponent = (serviceListItem: IMServiceListItem, configId: string) => {
    if (serviceListItem.searchServiceType === SearchServiceType.GeocodeService) {
      const outputDataSourceId = serviceListItem?.outputDataSourceId
      const outputDatasource = {
        dataSourceId: outputDataSourceId,
        mainDataSourceId: outputDataSourceId
      }
      const defaultQuery = {
        where: '1=1',
        sqlExpression: null,
        pageSize: config.resultMaxNumber,
        outFields: ['*'],
        page: 1,
        returnGeometry: true
      }
      return (<div key={`${configId}_con`}>
        {outputDataSourceId && <DataSourceComponent
          useDataSource={Immutable(outputDatasource)}
          query={defaultQuery}
          key={`${configId}_outputDataSource`}
          onDataSourceInfoChange={info => { handleRecordChange(serviceListItem, configId) }}
          onDataSourceStatusChange={status => { handleRecordChange(serviceListItem, configId, status) }}
          onSelectionChange={selection => { onSelectionChange(selection, configId) }}
          widgetId={id}
        />}
      </div>)
    }

    if (serviceListItem.searchServiceType === SearchServiceType.FeatureService) {
      const useDataSource = serviceListItem?.useDataSource
      const query = getQueryByServiceListItem(serviceListItem?.asMutable({ deep: true }))
      const localId = getLocalId(configId, id)
      return (<div key={`${configId}_con`}>
        {useDataSource && <DataSourceComponent
          useDataSource={Immutable(useDataSource)}
          query={query}
          key={`${configId}_useDataSource`}
          onDataSourceInfoChange={info => { handleRecordChange(serviceListItem, configId) }}
          onSelectionChange={selection => { onSelectionChange(selection, configId) }}
          //For localDs, we need to set `listenSelection` to `true` to listen to the selection changes of main datasource
          onDataSourceCreated={ds => { ds.setListenSelection(true) }}
          onDataSourceStatusChange={status => { handleDsStatusChange(Immutable(dsStatus.set(configId, status))) }}
          localId={localId}
        />}
      </div>)
    }
  }

  const createDsByServiceList = () => {
    const datasourceComponents = []
    for (const configId in serviceList) {
      datasourceComponents.push(renderDatasourceComponent(serviceList[configId], configId))
    }
    return datasourceComponents
  }

  const onSelectionChange = (selection: ImmutableArray<string>, configId: string) => {
    handleSelectionListChange(selection, configId)
  }

  const handleRecordChange = (serviceListItem: IMServiceListItem, configId: string, status?: DataSourceStatus) => {
    const { searchServiceType } = serviceListItem
    switch (searchServiceType) {
      case SearchServiceType.GeocodeService:
        loadGeocodeOutputRecords(serviceListItem?.asMutable({ deep: true }), config.resultMaxNumber, id).then(res => {
          const { records } = res
          const recordId = records?.map(record => record.getId())
          handleSearchResultChange(configId, recordId)
        })
        break
      case SearchServiceType.FeatureService:
        loadDsRecords(serviceListItem?.asMutable({ deep: true }), config.resultMaxNumber, id).then(res => {
          const { records } = res
          const recordId = records?.map(record => record.getId())
          handleSearchResultChange(configId, recordId)
        })
        break
    }

    if (status) {
      handleDsStatusChange(Immutable(dsStatus.set(configId, status)))
    }
  }

  return (
    <div>
      {
        createDsByServiceList()
      }
    </div>
  )
}

export default CreateDatasource
