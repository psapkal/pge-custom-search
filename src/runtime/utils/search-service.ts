import {
  type QueriableDataSource, type DataSource, dataSourceUtils, ClauseLogic, ClauseOperator, DataSourceManager, Immutable, type QueryParams, type FeatureLayerDataSource,
  DataSourceStatus, type FieldSchema, JimuFieldType, type SqlExpression
} from 'jimu-core'
import { type IMConfig, type Suggestion, type IMSearchDataConfig, type DatasourceListItem, type RecordResultType, type IMDatasourceSQLList } from '../../config'
import { getDatasource, checkIsDsCreated, getLocalId } from './utils'

export interface QueryOption {
  returnGeometry?: boolean
  geometry?: any
  sortField?: string
  sortOrder?: string
  orderByFields?: string | string[]
  resultOffset?: number
  resultRecordCount?: number
  pageSize?: number
  page?: number
  where?: string
}

export async function fetchLayerSuggestion (
  searchText: string,
  config: IMConfig,
  serviceListItem: DatasourceListItem
): Promise<Suggestion> {
  const datasourceConfig = config?.datasourceConfig || []
  if (!checkIsDsCreated(serviceListItem?.useDataSource?.dataSourceId)) {
    return Promise.resolve({} as Suggestion)
  }
  const searchFields = serviceListItem?.searchFields || []
  const datasourceConfigItem = datasourceConfig?.filter(item => item?.configId === serviceListItem.configId)?.[0]
  return fetchSuggestionRecords(searchText, serviceListItem, datasourceConfigItem, searchFields, config?.maxSuggestions)
}

/**
 * Query suggestion
*/
export async function fetchSuggestionRecords (
  searchText: string,
  datasourceListItem: DatasourceListItem,
  dsConfigItem: IMSearchDataConfig,
  searchFields: FieldSchema[],
  maxSuggestions: number
): Promise<Suggestion> {
  const { label, icon, configId } = dsConfigItem
  const useDatasourceId = datasourceListItem?.useDataSource?.dataSourceId
  const datasource = getDatasource(useDatasourceId)

  const option = {
    searchText,
    searchFields: searchFields.map(schema => schema.name),
    dataSource: datasource,
    maxSuggestions
  }
  return dataSourceUtils.querySuggestions(option).then(suggest => {
    const searchSuggestion = suggest?.map(item => {
      return {
        ...item,
        configId: configId,
        isFromSuggestion: true
      }
    })
    const suggestion: Suggestion = {
      suggestionItem: searchSuggestion,
      layer: label,
      icon: icon
    }
    return Promise.resolve(suggestion)
  }).catch((error) => {
    return Promise.resolve({
      suggestionItem: [],
      layer: null,
      icon: null
    })
  })
}

/**
 * Get query SQL
*/
export function getSQL (
  searchText: string,
  searchFields: FieldSchema[],
  datasource: DataSource,
  searchExact: boolean
): SqlExpression {
  if (searchFields) {
    const clauses = []
    searchFields.forEach(field => {
      let newSearchText = searchText as any
      const codedValues = (datasource as FeatureLayerDataSource)?.getFieldCodedValueList(field?.name)
      if (codedValues) {
        codedValues?.forEach(item => {
          if (newSearchText === item?.label) {
            newSearchText = item?.value as any
          }
        })
      }
      if (field.type === JimuFieldType.Number) {
        const newNumber = dataSourceUtils.convertStringToNumber(newSearchText)
        newNumber && (newSearchText = newNumber)
      }
      const isNumber = searchText?.length > 0 && !isNaN(Number(newSearchText)) && isFinite(Number(newSearchText))
      if (field.type === JimuFieldType.Number && !isNumber) return false
      const clauseOperator = getClauseOperator(field.type, searchExact)
      const searchValue = field.type === JimuFieldType.Number ? Number(newSearchText) : newSearchText
      const clause = dataSourceUtils.createSQLClause(field?.name, clauseOperator, [{ value: searchValue, label: searchValue + '' }])
      clauses.push(clause)
    })
    return dataSourceUtils.createSQLExpression(ClauseLogic.Or, clauses, datasource)
  }
}

/**
 * Update datasource params
*/
export function updateDsQueryParams (serviceListItem: DatasourceListItem, id: string, searchText: string) {
  const useDataSourceId = serviceListItem?.useDataSource?.dataSourceId
  const useDataSource = getDatasource(useDataSourceId)
  const SQL = serviceListItem?.SQL
  const where = !searchText ? '1=1' : (SQL?.sql || '1=0')
  const sqlExpression = !searchText ? null : (SQL?.sql ? SQL : null)
  const outFields = getOutFields(serviceListItem.searchFields, serviceListItem.displayFields, useDataSourceId)
  const query: any = Immutable({
    outFields: outFields,
    where,
    sqlExpression,
    returnGeometry: true
  })

  //Update datasource query params
  useDataSource && (useDataSource as QueriableDataSource).updateQueryParams(query, id)
}

/**
 * Update main datasource params
 * If a `datasource` is added multiple times in the same search widget, the `SQL` between them needs to bespliced width `OR`
*/
export function updateAllMainDsQueryParams (datasourceSQLList: IMDatasourceSQLList, id: string, searchText: string) {
  for (const dsId in datasourceSQLList?.asMutable({ deep: true })) {
    const sqlItem = datasourceSQLList?.[dsId]?.sqlExpression
    const outputFields = datasourceSQLList?.[dsId]?.outFields
    const useDataSource = getDatasource(dsId)
    let where
    let sqlExpression
    if (!searchText) {
      where = '1=1'
      sqlExpression = null
    } else {
      if (!sqlItem) {
        where = '1=0'
        sqlExpression = null
      } else {
        sqlExpression = dataSourceUtils.getMergedSQLExpressions(sqlItem?.asMutable({ deep: true }), useDataSource, ClauseLogic.Or)
        where = sqlExpression.sql
      }
    }
    const query: any = Immutable({
      outFields: outputFields,
      where,
      sqlExpression,
      returnGeometry: true
    })
    //Update datasource query params
    useDataSource && (useDataSource as QueriableDataSource).updateQueryParams(query, id)
  }
}

export function getOutFields (searchFields: FieldSchema[], displayFields: FieldSchema[], dsId: string): string[] | string {
  const searchFieldsNames = searchFields?.map(fieldSchema => fieldSchema.jimuName) || []
  const displayFieldsNames = displayFields?.map(fieldSchema => fieldSchema.jimuName) || []
  const useDataSource = getDatasource(dsId)
  const allUsedFields = useDataSource?.getAllUsedFields() || []
  if (allUsedFields === '*') {
    return '*'
  } else {
    return Array.from(new Set(searchFieldsNames.concat(displayFieldsNames).concat(allUsedFields)))
  }
}

export function getQueryByServiceListItem (serviceListItem: DatasourceListItem) {
  const { searchText, useDataSource } = serviceListItem
  const SQL = serviceListItem?.SQL
  const where = !searchText ? '1=1' : (SQL?.sql || '1=0')
  const sqlExpression = !searchText ? null : (SQL?.sql ? SQL : null)
  const outFields = getOutFields(serviceListItem.searchFields, serviceListItem.displayFields, useDataSource?.dataSourceId)
  const query: any = Immutable({
    outFields: outFields,
    where,
    sqlExpression,
    returnGeometry: true
  })
  return query
}

/**
 * Load records by outputDatasources
*/
export const loadDsRecords = (serviceListItem: DatasourceListItem, resultMaxNumber: number, id: string): Promise<RecordResultType> => {
  const dsId = serviceListItem?.useDataSource?.dataSourceId
  const localId = getLocalId(serviceListItem.configId, id)
  if (!checkIsDsCreated(dsId, localId)) return Promise.resolve({} as RecordResultType)
  const localDs = getDatasource(dsId, localId) as QueriableDataSource
  const dsManager = DataSourceManager.getInstance()
  const localDsId = dsManager.getLocalDataSourceId(dsId, localId)
  const records = localDs?.getRecordsByPage(1, resultMaxNumber)
  return Promise.resolve({
    records: records,
    configId: serviceListItem.configId,
    dsId: dsId,
    localDsId: localDsId,
    isGeocodeRecords: false
  })
}

function getClauseOperator (fieldType: JimuFieldType, searchExact: boolean): ClauseOperator {
  let clauseOperator: ClauseOperator
  if (fieldType === JimuFieldType.Number) {
    clauseOperator = ClauseOperator.NumberOperatorIs
  } else if (fieldType === JimuFieldType.String) {
    clauseOperator = searchExact ? ClauseOperator.StringOperatorIs : ClauseOperator.StringOperatorContains
  }
  return clauseOperator
}

export async function executeCountQuery (
  widgetId: string,
  outputDS: FeatureLayerDataSource,
  queryParams: QueryParams
): Promise<number> {
  outputDS.setCountStatus(DataSourceStatus.Unloaded)
  return outputDS.loadCount(queryParams, { widgetId, refresh: true })
}

export function initOutputDatasource (config: IMConfig) {
  config?.datasourceConfig?.forEach(datasourceConfigItem => {
    const outputDs = datasourceConfigItem?.outputDataSourceId
    const outputDatasource = getDatasource(outputDs)
    outputDatasource && outputDatasource.setCountStatus(DataSourceStatus.Loaded)
  })
}
