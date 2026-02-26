import { type DataSource, DataSourceManager, DataSourceStatus, type QueriableDataSource, MessageManager, getAppStore, DataRecordSetChangeMessage, RecordSetChangeType, urlUtils, utils, Immutable, UrlManager } from 'jimu-core'
import {
  RECENT_SEARCHES_KEY, type IMConfig, type SearchDataConfig, type SuggestionItem, type ServiceList, type SearchStatus,
  SearchServiceType, type Suggestion, SearchResultView, type RecordResultType, type IMDatasourceListItem, type DatasourceSQLList
} from '../../config'
import { fetchGeocodeSuggestions, loadGecodeRecords, loadGeocodeOutputRecords } from './locator-service'
import { fetchLayerSuggestion, loadDsRecords, updateAllMainDsQueryParams, getOutFields } from './search-service'
export interface SetRecentSearcheOptions {
  searchText: string
  id: string
  recentSearchesMaxNumber: number
  isShowRecentSearches: boolean
}
export interface UpdateQueryParamsOption {
  serviceList: ServiceList
  searchText: string
  searchResultView: SearchResultView
  id: string
}

/**
 * Get all suggestion
*/
export const getSuggestions = (
  searchText: string,
  serviceList: ServiceList,
  config: IMConfig
): Promise<Suggestion[]> => {
  const suggestionPromiseList = []
  for (const configId in serviceList) {
    const serviceItem = serviceList[configId]
    let suggestionPromise
    if (serviceItem.searchServiceType === SearchServiceType.FeatureService) {
      suggestionPromise = fetchLayerSuggestion(searchText, config, serviceItem)
    } else {
      suggestionPromise = fetchGeocodeSuggestions(searchText, serviceItem)
    }
    suggestionPromiseList.push(suggestionPromise)
  }
  return Promise.all(suggestionPromiseList)
}

/**
 * Update records of output dataSource
*/
export const updateRecordsOfOutputDs = (option: UpdateQueryParamsOption) => {
  const { serviceList, searchText, searchResultView } = option
  const geocodeFetchPromiseList = []
  for (const configId in serviceList) {
    const serviceItem = serviceList[configId]
    const { searchServiceType, resultMaxNumber } = serviceItem
    if (searchServiceType === SearchServiceType.GeocodeService) {
      //Update records of output dataSource
      const maxResultNumber = searchResultView === SearchResultView.ResultPanel ? resultMaxNumber : null
      const loadGeocodeRecordPromise = loadGecodeRecords(searchText, maxResultNumber, serviceItem, searchResultView)
      geocodeFetchPromiseList.push(loadGeocodeRecordPromise)
    }
  }
  return Promise.all(geocodeFetchPromiseList)
}

export function updateAllLayerServiceDsQueryParams (option: UpdateQueryParamsOption) {
  const { serviceList, searchText, id } = option
  const datasourceSqlList = {} as DatasourceSQLList
  for (const configId in serviceList) {
    const serviceItem = serviceList[configId]
    const { searchServiceType, useDataSource } = serviceItem
    if (searchServiceType === SearchServiceType.FeatureService && useDataSource?.dataSourceId) {
      const dsId = useDataSource?.dataSourceId
      let newSqlList = datasourceSqlList?.[dsId]?.sqlExpression || null
      let outFields = datasourceSqlList[dsId]?.outFields || []
      const outFieldsOfServiceItem = getOutFields(serviceItem.searchFields, serviceItem.displayFields, dsId) || []
      if (!datasourceSqlList[dsId]) {
        newSqlList = serviceItem?.SQL ? [serviceItem?.SQL as any] : null
        outFields = outFieldsOfServiceItem as any
        datasourceSqlList[dsId] = {} as any
      } else {
        serviceItem?.SQL && newSqlList.push(serviceItem?.SQL as any)
        outFields = Array.from(new Set(outFields.concat(outFieldsOfServiceItem)))
      }
      datasourceSqlList[dsId].sqlExpression = newSqlList
      datasourceSqlList[dsId].outFields = outFields
    }
  }
  updateAllMainDsQueryParams(Immutable(datasourceSqlList), id, searchText)
}

export const clearFilterOfDeletedDs = (serviceList: IMDatasourceListItem, widgetId: string, configId: string, enableFiltering: boolean) => {
  const useDataSourceId = serviceList?.useDataSource?.dataSourceId
  const localId = getLocalId(configId, widgetId)
  const useDataSource = getDatasource(useDataSourceId)
  const localDataSource = getDatasource(useDataSourceId, localId)
  localDataSource && (localDataSource as QueriableDataSource).updateQueryParams({}, localId)
  if (enableFiltering && useDataSource) {
    (useDataSource as QueriableDataSource).updateQueryParams({}, widgetId)
  }
}

export const loadAllDsRecord = (serviceList: ServiceList, resultMaxNumber: number, id: string, isPublishRecordCreateAction: boolean = false): Promise<RecordResultType[]> => {
  const suggestionPromiseList = []
  for (const configId in serviceList) {
    const serviceItem = serviceList[configId]
    let suggestionPromise
    if (serviceItem.searchServiceType === SearchServiceType.FeatureService) {
      suggestionPromise = loadDsRecords(serviceItem, resultMaxNumber, id)
    } else {
      suggestionPromise = loadGeocodeOutputRecords(serviceItem, resultMaxNumber, id, isPublishRecordCreateAction)
    }
    suggestionPromiseList.push(suggestionPromise)
  }
  return Promise.all(suggestionPromiseList)
}

/**
 * Get datasource by datasourceId
*/
export const getDatasource = (dsId: string, localeId?: string): DataSource => {
  if (!dsId) return null
  if (!localeId) {
    const dsManager = DataSourceManager.getInstance()
    return dsManager.getDataSource(dsId)
  } else {
    const dsManager = DataSourceManager.getInstance()
    const localDsId = dsManager.getLocalDataSourceId(dsId, localeId)
    return dsManager.getDataSource(localDsId)
  }
}

/**
 * De-duplicate for object or Arrary
*/
export const uniqueJson = (jsonArr, key) => {
  const result = jsonArr[0] ? [jsonArr[0]] : []
  for (let i = 1; i < jsonArr.length; i++) {
    const item = jsonArr[i]
    let repeat = false
    for (let j = 0; j < result.length; j++) {
      if (item[key] === result[j][key]) {
        repeat = true
        break
      }
    }
    if (!repeat) {
      result.push(item)
    }
  }
  return result
}

/**
 * Save the current search to localStorage after the text of search input changes
*/
export const setRecentSearches = (options: SetRecentSearcheOptions) => {
  const { searchText, id, recentSearchesMaxNumber, isShowRecentSearches } = options
  const appId = urlUtils.getAppIdPageIdFromUrl().appId
  const recentSearchKey = getRecentSearchesKey(appId, id)
  if (!isShowRecentSearches || !searchText) return false
  let recentSearches = getRecentSearches(id)
  if (!recentSearches.includes(searchText)) {
    recentSearches.unshift(searchText)
    recentSearches = recentSearches.splice(0, recentSearchesMaxNumber || 10)
    utils.setLocalStorage(recentSearchKey, escape(recentSearches.join('/@/')))
  }
}

/**
 * Get recent searches from localStorage
*/
export const getRecentSearches = (id: string): string[] => {
  const appId = urlUtils.getAppIdPageIdFromUrl().appId
  const recentSearchKey = getRecentSearchesKey(appId, id)
  let recentSearchInLocal = utils.readLocalStorage(recentSearchKey)
  if (recentSearchInLocal) {
    recentSearchInLocal = unescape(recentSearchInLocal)
  }
  const recentSearches = recentSearchInLocal ? recentSearchInLocal?.split('/@/') : []
  return recentSearches
}

/**
 * Delete recent suggestion by index
*/
export const deleteRecentSearches = (index: number, id: string) => {
  const appId = urlUtils.getAppIdPageIdFromUrl().appId
  const recentSearchKey = getRecentSearchesKey(appId, id)
  if (!index && index !== 0) return false
  const recentSearches = getRecentSearches(id)
  recentSearches.splice(index, 1)
  const localRecentSearches = recentSearches?.length > 0 ? escape(recentSearches.join('/@/')) : ''
  utils.setLocalStorage(recentSearchKey, localRecentSearches)
}

const getRecentSearchesKey = (appId: string, id: string) => {
  return `exb-${appId}-${id}_${RECENT_SEARCHES_KEY}`
}

/**
 * Clear all current searches
*/
export const clearRecentSearches = (id: string) => {
  const appId = urlUtils.getAppIdPageIdFromUrl().appId
  const recentSearchKey = getRecentSearchesKey(appId, id)
  utils.setLocalStorage(recentSearchKey, '')
}

/**
 * Get datasource config item form config by configId
*/
export const getDatasourceConfigItemByConfigId = (config: IMConfig, configId: string): SearchDataConfig => {
  return config?.asMutable({ deep: true })?.datasourceConfig?.filter(item => item.configId === configId)?.[0]
}

export const getJsonLength = (json): number => {
  let length = 0
  //eslint-disable-next-line
  for (const key in json) {
    length++
  }
  return length
}

/**
 * Check whether the suggestion is repeated
*/
export function checkIsSuggestionRepeat (searchSuggestion: SuggestionItem[], suggestionRecord: string): boolean {
  return searchSuggestion.filter(suggestion => {
    return suggestionRecord === suggestion?.suggestion
  }).length > 0
}

/**
 * Init suggestion list item (Bold search text)
*/
export function getSuggestionItem (suggestion: string, searchText: string): string {
  if (!searchText) return suggestion
  const searchReg = new RegExp(`(${escapeRegex(searchText)})`, 'gi')
  const replaceReg = new RegExp(`(${escapeRegex(searchText)})`, 'gi')
  return suggestion.match(searchReg) ? suggestion.replace(replaceReg, '<strong >$1</strong>') : suggestion
}

export function escapeRegex (string) {
  return string.replace(/[-[\]{}()*+!<=:?.\/\\^$|#\s,]/g, '\\$&')
}

/**
 * Change datasource status
*/
export function changeDsStatus (ds: QueriableDataSource, status: DataSourceStatus) {
  ds.setStatus(status)
  ds.setCountStatus(status)
}

/**
 * Check is datasource created
*/
export function checkIsDsCreated (dsId: string, localeId?: string): boolean {
  if (!dsId) return false
  return !!getDatasource(dsId, localeId)
}

export function getResultPopperOffset (isMultipleService: boolean): number[] {
  return isMultipleService ? [-32, 3] : [0, 3]
}

/**
 * Publish message action after records update
*/
export const publishRecordCreatedMessageAction = (widgetId: string, recordsArr: RecordResultType[], recordSetChangeType: RecordSetChangeType = RecordSetChangeType.CreateUpdate) => {
  const outputRecordResult = []
  recordsArr?.forEach(item => {
    if (item?.isGeocodeRecords) {
      const ds = getDatasource(item.dsId) as QueriableDataSource
      const fields = item?.displayFields?.map((fieldInfo) => fieldInfo.jimuName)
      const outputRecordItem = {
        records: item.records,
        fields: fields,
        dataSource: ds,
        name: ds.id
      }
      outputRecordResult.push(outputRecordItem)
    }
  })
  const dataRecordSetChangeMessage = new DataRecordSetChangeMessage(widgetId, recordSetChangeType, outputRecordResult)
  MessageManager.getInstance().publishMessage(dataRecordSetChangeMessage)
}

export const getLocalId = (configId: string, widgetId: string): string => {
  return `${widgetId}_${configId}_useDataSource`
}

//Check whether all records are loaded after update ds query params
export const checkIsAllRecordLoaded = (serviceList: ServiceList, id: string) => {
  let isAllRecordLoaded = true
  for (const configId in serviceList) {
    const serviceListItem = serviceList[configId]
    let ds
    if (serviceListItem.searchServiceType === SearchServiceType.FeatureService) {
      const dsId = serviceListItem?.useDataSource?.dataSourceId
      const localId = getLocalId(serviceListItem.configId, id)
      ds = getDatasource(dsId, localId) as QueriableDataSource
    } else {
      const dsId = serviceListItem?.outputDataSourceId
      ds = getDatasource(dsId) as QueriableDataSource
    }

    const status = ds?.getStatus()
    if (status === DataSourceStatus.Loading) {
      isAllRecordLoaded = false
    }
  }
  return isAllRecordLoaded
}

export const checkIsAllDsCreated = (serviceList: ServiceList, id: string) => {
  let isAllDsCreated = true
  for (const configId in serviceList) {
    const serviceListItem = serviceList[configId]
    let ds
    if (serviceListItem.searchServiceType === SearchServiceType.FeatureService) {
      const dsId = serviceListItem?.useDataSource?.dataSourceId
      const localId = getLocalId(serviceListItem.configId, id)
      const isDsCreated = checkIsDsCreated(dsId, localId)
      if (!isDsCreated) {
        isAllDsCreated = false
      }
    } else {
      const dsId = serviceListItem?.outputDataSourceId
      ds = getDatasource(dsId) as QueriableDataSource
      if (!ds) {
        isAllDsCreated = false
      }
    }
  }
  return isAllDsCreated
}

export const getSearchStatusInUrl = (widgetId: string) => {
  if (!widgetId) return
  const state = getAppStore().getState()
  const status = JSON.parse(state?.urlHashObject?.[widgetId]?.search_status || '{}')
  return status
}

export const handleSearchWidgetUrlParamsChange = (widgetId: string, searchStatus: SearchStatus) => {
  if (!widgetId) return
  const searchStatusString = searchStatus ? JSON.stringify(searchStatus) : null
  UrlManager.getInstance().setWidgetUrlParams(widgetId, {
    search_status: searchStatusString
  })
}

export const handleSearchWidgetUrlParamsItemChange = (widgetId: string, key: string, value: any) => {
  if (!key || !widgetId) return
  const searchStatus = getSearchStatusInUrl(widgetId)
  const newSearchStatus = searchStatus || {} as any
  newSearchStatus[key] = value
  UrlManager.getInstance().setWidgetUrlParams(widgetId, {
    search_status: JSON.stringify(newSearchStatus)
  })
}
