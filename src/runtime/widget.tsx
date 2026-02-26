/** @jsx jsx */
import { React, css, jsx, type AllWidgetProps, Immutable, type ImmutableArray, polished, type UseUtility, UtilityManager, hooks } from 'jimu-core'
import { ViewVisibilityContext, type ViewVisibilityContextProps, PageVisibilityContext } from 'jimu-layouts/layout-runtime'
import { type IMConfig, type SearchDataConfig, ArrangementStyle, type NewDatasourceConfigItem, type IMServiceList, type IMSearchResult, SearchServiceType, type IMSearchDataConfig, type IMSelectionList, type IMDatasourceCreatedStatus } from '../config'
import SearchSetting from './component/search-setting'
import SearchInput from './component/search'
import CreateDatasource from './component/create-datasource'
import { versionManager } from '../version-manager'
import { getSearchStatusInUrl } from './utils/utils'
const { useEffect, useState, useRef } = React
type SearchProps = AllWidgetProps<IMConfig>

const Widget = (props: SearchProps) => {
  const { config, id, useDataSources } = props
  const { resultMaxNumber } = config
  const searchConRef = useRef<HTMLDivElement>(null)
  const selectionListRef = useRef<IMSelectionList>(Immutable({}) as IMSelectionList)

  const [datasourceConfig, setDatasourceConfig] = useState(Immutable([]) as ImmutableArray<NewDatasourceConfigItem>)
  const [isShowSearchInput, setIsShowSearchInput] = useState(false)
  const [serviceList, setServiceList] = useState(null as IMServiceList)
  const [searchResult, setSearchResult] = useState(Immutable({}) as IMSearchResult)
  const [selectionList, setSelectionList] = useState(Immutable({}) as IMSelectionList)
  const [dsStatus, setDsStatus] = useState(Immutable({}) as IMDatasourceCreatedStatus)

  useEffect(() => {
    initDatasourceConfig()
    // eslint-disable-next-line
  }, [config])

  const STYLE = css`
    & {
      height: ${polished.rem(32)};
      margin-top: 1px;
      margin-left: 1px;
    }
    &.search-con-Style3 {
      border-bottom: 1px solid var(--ref-palette-neutral-500);
    }
  `
  const onDatasourceConfigChange = (newDatasourceConfig: ImmutableArray<NewDatasourceConfigItem>) => {
    newDatasourceConfig && setDatasourceConfig(newDatasourceConfig)
    initServiceList(newDatasourceConfig)
  }

  const initDatasourceConfig = async () => {
    const dsConfig = config?.datasourceConfig || Immutable([]) as ImmutableArray<SearchDataConfig>
    const newDsPromise = dsConfig.map(async configItem => {
      const enable = getDsConfigItemEnableStatus(configItem)
      let newConfigItem = configItem?.setIn(['enable'], enable)
      if (configItem?.useUtility) {
        await getUrlOfUseUtility(configItem?.useUtility).then(geocodeUrl => {
          newConfigItem = newConfigItem.setIn(['geocodeURL'], geocodeUrl)
        })
      }
      return Promise.resolve(newConfigItem?.asMutable({ deep: true }))
    })
    await Promise.all(newDsPromise).then(newDsConfig => {
      setDatasourceConfig(Immutable(newDsConfig as NewDatasourceConfigItem[]))
      initServiceList(Immutable(newDsConfig as NewDatasourceConfigItem[]))
    })
  }

  const getDsConfigItemEnableStatus = (configItem: IMSearchDataConfig) => {
    if (!datasourceConfig || datasourceConfig?.length === 0) {
      const searchStatus = getSearchStatusInUrl(id)
      const activeServciceConfigIdList = searchStatus?.serviceEnabledList
      if (activeServciceConfigIdList) {
        return activeServciceConfigIdList.includes(configItem?.configId)
      } else {
        return true
      }
    } else {
      let enable = true
      datasourceConfig?.forEach(preItem => {
        if (configItem?.configId === preItem?.configId) {
          enable = !!preItem?.enable
        }
      })
      return enable
    }
  }

  const getUrlOfUseUtility = async (useUtility: UseUtility): Promise<string> => {
    return UtilityManager.getInstance().getUrlOfUseUtility(useUtility)
      .then((url) => {
        return Promise.resolve(url)
      })
  }

  const handleServiceListChange = (serviceList: IMServiceList) => {
    setServiceList(serviceList)
  }

  const checkIsShowSearchInput = () => {
    if (config?.arrangementStyle === ArrangementStyle.Style1 || config?.arrangementStyle === ArrangementStyle.Style2 || config?.arrangementStyle === ArrangementStyle.Style3) {
      return true
    } else {
      return isShowSearchInput
    }
  }

  const onShowSearchInputChange = (isShow: boolean) => {
    setIsShowSearchInput(isShow)
  }

  const initServiceList = (newDatasourceConfig: ImmutableArray<NewDatasourceConfigItem>) => {
    let newServiceList = Immutable({})
    newDatasourceConfig?.asMutable({ deep: true })?.forEach(configItem => {
      if (!configItem?.enable) return false
      const { configId } = configItem
      let newDatasourceListItem
      if (configItem?.searchServiceType === SearchServiceType.GeocodeService) {
        newDatasourceListItem = initGeocodeList(configItem)
      } else {
        newDatasourceListItem = initDatasourceList(configItem)
      }
      newServiceList = newServiceList.setIn([configId], newDatasourceListItem)
    })
    setServiceList(newServiceList as IMServiceList)
  }

  /**
   * Init datasource list by enable config item
  */
  const initDatasourceList = hooks.useEventCallback((configItem: NewDatasourceConfigItem) => {
    if (!configItem?.enable || configItem?.searchServiceType === SearchServiceType.GeocodeService) return false
    const { configId, useDataSource, displayFields, searchFields, searchExact, hint, searchServiceType } = configItem
    const datasourceListItem = serviceList?.[configId]?.asMutable({ deep: true }) || {}
    const updateItem = {
      useDataSource: useDataSource,
      displayFields: displayFields,
      searchFields: searchFields,
      searchExact: searchExact,
      maxSuggestions: config?.maxSuggestions,
      resultMaxNumber: resultMaxNumber,
      hint: hint,
      searchServiceType: searchServiceType,
      configId: configId
    }
    const newDatasourceListItem = Object.assign(datasourceListItem, updateItem)
    return newDatasourceListItem
  })

  /**
   * Init geocode list by enable config item
  */
  const initGeocodeList = (configItem: NewDatasourceConfigItem) => {
    if (!configItem?.enable || configItem?.searchServiceType === SearchServiceType.FeatureService) return false
    const { configId, hint, geocodeURL, outputDataSourceId, label, searchServiceType, spatialReference, singleLineFieldName, displayFields, defaultAddressFieldName, addressFields, isSupportSuggest, useUtility } = configItem
    const datasourceListItem = serviceList?.[configId]?.asMutable({ deep: true }) || {}
    const updateItem = {
      hint: hint,
      geocodeURL: geocodeURL,
      outputDataSourceId: outputDataSourceId,
      icon: configItem?.icon,
      maxSuggestions: config?.maxSuggestions,
      resultMaxNumber: resultMaxNumber,
      label: label,
      searchServiceType: searchServiceType,
      configId: configId,
      singleLineFieldName: singleLineFieldName || '',
      displayFields: displayFields,
      defaultAddressFieldName: defaultAddressFieldName,
      addressFields: addressFields || [],
      isSupportSuggest: isSupportSuggest,
      useUtility: useUtility,
      spatialReference: spatialReference
    }
    const newDatasourceListItem = Object.assign(datasourceListItem, updateItem)
    return newDatasourceListItem
  }

  const handleSearchResultChange = (configId: string, newRecords: string[]) => {
    const newSearchResult = searchResult.set(configId, newRecords)
    setSearchResult(Immutable(newSearchResult))
  }

  const clearSearchResult = () => {
    setSearchResult(Immutable({}) as IMSearchResult)
  }

  const handleSelectionListChange = hooks.useEventCallback((selection: ImmutableArray<string>, configId: string) => {
    const newSelectionList = selectionListRef.current.setIn([configId], selection)
    setSelectionList(newSelectionList)
    selectionListRef.current = newSelectionList
  })

  const handleDsStatusChange = (dsStatus: IMDatasourceCreatedStatus) => {
    setDsStatus(dsStatus)
  }

  return (
    <ViewVisibilityContext.Consumer>
      {({ isInView, isInCurrentView }: ViewVisibilityContextProps) => {
        const isSearchInCurrentView = isInView ? isInCurrentView : true
        return (
          <PageVisibilityContext.Consumer>
            {(isWidgetInCurrentPage) => {
              return (
                <div className='widget-search jimu-widget'>
                  <div className={`d-flex w-100 align-items-center search-con-${config.arrangementStyle}`} css={STYLE} ref={searchConRef}>
                    <div>
                      {(config?.datasourceConfig?.length > 1 && checkIsShowSearchInput()) && <SearchSetting
                        className='h-100'
                        config={config}
                        dsStatus={dsStatus}
                        datasourceConfig={datasourceConfig}
                        id={id}
                        useDataSources={useDataSources}
                        onDatasourceConfigChange={onDatasourceConfigChange}
                      />}
                    </div>
                    <SearchInput
                      id={id}
                      className='flex-grow-1 h-100'
                      reference={searchConRef}
                      config={config}
                      isShowSearchInput={checkIsShowSearchInput()}
                      onShowSearchInputChange={onShowSearchInputChange}
                      isInCurrentView={isSearchInCurrentView}
                      isWidgetInCurrentPage={isWidgetInCurrentPage}
                      handleServiceListChange={handleServiceListChange}
                      searchResult={searchResult}
                      serviceList={serviceList}
                      clearSearchResult={clearSearchResult}
                      selectionList={selectionList}
                    />
                    <CreateDatasource
                      id={id}
                      config={config}
                      serviceList={serviceList}
                      dsStatus={dsStatus}
                      handleSearchResultChange={handleSearchResultChange}
                      handleSelectionListChange={handleSelectionListChange}
                      handleDsStatusChange={handleDsStatusChange}
                    />
                  </div>
                </div>
              )
            }}
          </PageVisibilityContext.Consumer>
        )
      }}
    </ViewVisibilityContext.Consumer>
  )
}
Widget.versionManager = versionManager
export default Widget
