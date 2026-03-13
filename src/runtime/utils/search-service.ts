import {
  type QueriableDataSource, type DataSource, dataSourceUtils, ClauseLogic, ClauseOperator, DataSourceManager, Immutable, type QueryParams, type FeatureLayerDataSource,
  DataSourceStatus, type FieldSchema, JimuFieldType, type SqlExpression
} from 'jimu-core'
import { type IMConfig, type Suggestion, type IMSearchDataConfig, type DatasourceListItem, type RecordResultType, type IMDatasourceSQLList, type SuggestionItem } from '../../config'
import { getDatasource, checkIsDsCreated, getLocalId } from './utils'

interface CodedValueItem {
  value: string | number
  label: string
}

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
  const datasource = getDatasource(useDatasourceId) as any
  const fieldNames = (searchFields || []).map(field => field?.name || field?.jimuName).filter(Boolean)
  const isSearchExact = datasourceListItem?.searchExact || false
  const sqlExpression = datasourceListItem?.SuggestionSQL || getSQL(searchText, searchFields, datasource, isSearchExact)
  const queryParams: any = Immutable({
    where: sqlExpression?.sql || '1=0',
    sqlExpression: sqlExpression?.sql ? sqlExpression : null,
    outFields: fieldNames.length ? fieldNames : '*',
    pageSize: maxSuggestions,
    returnGeometry: false
  })

  return datasource?.query(queryParams).then(queryResult => {
    const records = queryResult?.records || []
    const uniqueSuggestions = new Set<string>()
    const suggestionItem: SuggestionItem[] = []
    records.forEach(record => {
      const suggestionValue = getSuggestionValue(record, searchFields, datasource)
      const suggestionText = suggestionValue != null ? `${suggestionValue}` : ''
      if (!suggestionText || uniqueSuggestions.has(suggestionText)) return
      uniqueSuggestions.add(suggestionText)
      suggestionItem.push({
        suggestionHtml: suggestionText,
        suggestion: suggestionText,
        configId,
        isFromSuggestion: true
      })
    })

    const codedValueSuggestions = getCodedValueSuggestions(searchText, datasource, searchFields, configId, uniqueSuggestions)
    suggestionItem.push(...codedValueSuggestions)

    const suggestion: Suggestion = {
      suggestionItem: suggestionItem.slice(0, maxSuggestions),
      layer: label,
      icon
    }
    return Promise.resolve(suggestion)
  }).catch(() => {
    return Promise.resolve({
      suggestionItem: [],
      layer: null,
      icon: null
    })
  })
}

function getSuggestionValue (record: any, searchFields: FieldSchema[], datasource: DataSource): string | number {
  for (const field of searchFields || []) {
    const jimuName = field?.jimuName
    const name = field?.name
    const valueByJimuName = jimuName ? record?.getFieldValue?.(jimuName) : undefined
    const valueByName = name ? record?.getFieldValue?.(name) : undefined
    const attrValue = record?.feature?.attributes?.[name]
    const value = valueByJimuName ?? valueByName ?? attrValue
    if (value !== null && value !== undefined && `${value}`.trim() !== '') {
      const codedValues = getFieldCodedValueList(datasource, field)
      const codedLabel = getCodedLabelByValue(value, codedValues)
      return codedLabel ?? value
    }
  }
  return ''
}

function getCodedValueSuggestions (
  searchText: string,
  datasource: DataSource,
  searchFields: FieldSchema[],
  configId: string,
  uniqueSuggestions: Set<string>
): SuggestionItem[] {
  const suggestionItems: SuggestionItem[] = []
  const keyword = (searchText || '').trim().toLocaleLowerCase()
  if (!keyword) return suggestionItems

  for (const field of searchFields || []) {
    const codedValues = getFieldCodedValueList(datasource, field)
    codedValues?.forEach(codedValue => {
      const suggestionText = `${codedValue?.label || ''}`.trim()
      if (!suggestionText) return
      if (!suggestionText.toLocaleLowerCase().includes(keyword)) return
      if (uniqueSuggestions.has(suggestionText)) return
      uniqueSuggestions.add(suggestionText)
      suggestionItems.push({
        suggestionHtml: suggestionText,
        suggestion: suggestionText,
        configId,
        isFromSuggestion: true
      })
    })
  }

  return suggestionItems
}

function getFieldCodedValueList (datasource: DataSource, field: FieldSchema): CodedValueItem[] {
  const flDatasource = datasource as FeatureLayerDataSource
  if (!flDatasource?.getFieldCodedValueList) return []

  const fieldName = field?.name || field?.jimuName
  if (!fieldName) return []
  const codedValues = flDatasource.getFieldCodedValueList(fieldName)
  return (codedValues || []) as CodedValueItem[]
}

function getCodedLabelByValue (value: string | number, codedValues: CodedValueItem[]): string | null {
  if (!codedValues?.length) return null
  const match = codedValues.find(item => {
    return item?.value === value || `${item?.value}` === `${value}`
  })
  return match?.label || null
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
    const clauses: any[] = []
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
      const searchValue = field.type === JimuFieldType.Number
        ? Number(newSearchText)
        : newSearchText
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
