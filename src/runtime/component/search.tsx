/** @jsx jsx */
import {
  React, css, ReactRedux, type IMState, jsx, polished, Immutable, type LinkResult, type LinkTo, DataSourceStatus, type QueriableDataSource, lodash,
  AppMode, RecordSetChangeType, MessageManager, DataRecordsSelectionChangeMessage, DataSourceFilterChangeMessage, hooks, DataRecordSetChangeMessage, classNames
} from 'jimu-core'
import { TextInput, Button, Link, type LinkTarget, defaultMessages as jimuiDefaultMessage } from 'jimu-ui'
import { type IMConfig, type Suggestion, SearchResultView, type ServiceList, type InitResultServiceListOption, SearchServiceType, type IMServiceList, type IMSearchResult, type IMSelectionList, ArrangementStyle } from '../../config'
import { getSQL } from '../utils/search-service'
import {
  getDatasource, setRecentSearches, getRecentSearches, clearFilterOfDeletedDs, clearRecentSearches, getJsonLength, changeDsStatus, checkIsDsCreated, getSuggestions, loadAllDsRecord,
  publishRecordCreatedMessageAction, updateAllLayerServiceDsQueryParams, updateRecordsOfOutputDs, checkIsAllRecordLoaded, checkIsAllDsCreated, getSearchStatusInUrl, handleSearchWidgetUrlParamsChange
} from '../utils/utils'
import SuggestionList from './suggestion-list'
import LocationAndRecentSearch from './location-and-recent-searches'
import ResultList from './result-list'
import { SearchOutlined } from 'jimu-icons/outlined/editor/search'
import { CloseOutlined } from 'jimu-icons/outlined/editor/close'
import defaultMessage from '../translations/default'
import { useTheme } from 'jimu-theme'
const { useSelector } = ReactRedux
const { useState, useEffect, useRef, useMemo } = React
interface SearchSettingProps {
  config: IMConfig
  reference: any
  id: string
  className?: string
  isShowSearchInput: boolean
  isInCurrentView: boolean
  isWidgetInCurrentPage: boolean
  searchResult: IMSearchResult
  serviceList: IMServiceList
  selectionList: IMSelectionList
  onShowSearchInputChange: (isShow: boolean) => void
  handleServiceListChange: (serviceList: IMServiceList) => void
  clearSearchResult: () => void
}

const SearchInput = (props: SearchSettingProps) => {
  const nls = hooks.useTranslation(defaultMessage, jimuiDefaultMessage)
  const theme = useTheme()
  const queryObject = useSelector((state: IMState) => state?.queryObject)
  const appMode = useSelector((state: IMState) => state?.appRuntimeInfo?.appMode)
  const debounceQuerySuggestionRef = useRef((searchText: string) => undefined)
  const linkRef = useRef<HTMLButtonElement>(null)
  const clearSearchValueTimeoutRef = useRef(null)

  const resultFirstItem = useRef(null)
  const resultServiceListRef = useRef<ServiceList>(null)

  const preServiceList = useRef<IMServiceList>(null)
  const hasSetPreServiceList = useRef<boolean>(false)
  const preEnableFiltering = useRef<boolean>(false)
  const didMount = useRef<boolean>(false)
  const newServiceListRef = useRef<IMServiceList>(null)
  const checkIsToOtherWidgetTimeoutRef = useRef<any>(null)
  const checkIsAllDsStatusLoadedTimeoutRef = useRef<any>(null)
  const isHasConfirmSearchRef = useRef<boolean>(false)

  const isHasConfirmSearchByUrlParamsRef = useRef<boolean>(false)

  //Input Ref
  const searchValueRef = useRef(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const inputBlurTimeoutRef = useRef(null)

  //Result list/Suggestion/Recent searches ref
  const perLocationLoading = useRef<boolean>(false)
  const confirmSearchByInUrlSearchTextTimeout = useRef(null)
  const preIsOpentResultPopperRef = useRef(false)
  const suggestionFirstItem = useRef(null)
  const recentSearchFirstItem = useRef(null)
  const isFocusSuggestion = useRef<boolean>(false)
  const isFocusLocationAndRecentSearch = useRef<boolean>(false)
  const locationLoadingRef = useRef<boolean>(false)

  const { config, className, reference, id, isShowSearchInput, isInCurrentView, isWidgetInCurrentPage, serviceList, searchResult, selectionList, handleServiceListChange, clearSearchResult } = props
  const { isShowRecentSearches, recentSearchesMaxNumber, linkParam, searchResultView, resultMaxNumber } = config

  //suggestion
  const [searchValue, setSearchValue] = useState(null)
  const [isShowLoading, setIsShowLoading] = useState(false)
  const [isOpenSuggestion, setIsOpenSuggestion] = useState(false)
  const [isHasServiceSupportSuggest, setIsHasServiceSupportSuggest] = useState(false)
  const [searchSuggestion, setSearchSuggestion] = useState([] as Suggestion[])

  //Result list
  const [resultServiceList, setResultServiceList] = useState({} as ServiceList)
  const [isOpentResultPopper, setIsOpentResultPopper] = useState(false)
  const [isOpentResultListDefault, setIsOpentResultListDefault] = useState(false)

  const [searchPlaceholder, setSearchPlaceholder] = useState(null)

  //Location or recent searches
  const [locationLoading, setLocationLoading] = useState(false)
  const [openLocationOrRecentSearches, setOpenLocationOrRecentSearches] = useState(false)
  const [recentSearchesData, setRecentSearchesData] = useState([] as Suggestion[])
  const [isGetLocationError, setIsGetLocationError] = useState(false)

  //This dsId is just the id of the datasource where the record selected by the current search is located
  const [dsIdOfSelectedResultItem, setDsIdOfSelectedResultItem] = useState(null)

  //Utility error remind
  const [openUtilityErrRemindInSuggestion, setOpenUtilityErrRemindInSuggestion] = useState(false)
  const [openUtilityErrRemindInResult, setOpenUtilityErrRemindInResult] = useState(false)

  const STYLE = css`
    .input-wrapper {
      height: 100% !important;
    }
    .loading-con {
      @keyframes loading {
        0% {transform: rotate(0deg); };
        100% {transform: rotate(360deg)};
      }
      width: ${polished.rem(16)};
      height: ${polished.rem(16)};
      min-width: ${polished.rem(16)};
      border: 2px solid ${theme?.sys.color?.secondary?.light};
      border-radius: 50%;
      border-top: 2px solid ${theme?.sys.color?.primary?.main};
      box-sizing: border-box;
      animation:loading 2s infinite linear;
      box-sizing: border-box;
    }
    .search-button {
      width: ${polished.rem(32)};
      border-radius: 0;
    }
    .search-input-con input{
      width: 100%;
    }
    .search-link-con {
      width: 0;
      height: 0;
      overflow: hidden;
    }
    &.arrangement-Style1 {
      .search-button {
        border-radius: 0 ${polished.rem(4)} ${polished.rem(4)} 0;
      }
      .input-wrapper {
        border-radius: ${polished.rem(4)} 0 0 ${polished.rem(4)};
      }
      .no-border-left .input-wrapper{
        border-radius: 0;
        border-left: none;
      }
    }
    &.arrangement-Style2 {
      & {
        padding-right: 1px;
      }
      .input-prefix-icon {
        color: var(--ref-palette-neutral-600);
      }
      .input-wrapper {
        border-radius: ${polished.rem(32)} !important;
      }
    }
    &.arrangement-Style3 {
      .input-wrapper {
        background: none;
        border: none;
      }
      .search-button {
        background: none;
      }
    }
  `

  //After switching the page or view, judge whether to open the result panel according to the open situation of the previous result panel
  useEffect(() => {
    //If the search is in the page or the current view, judge whether to open the result panel according to the previous open state of the result panel
    if (preIsOpentResultPopperRef.current && isInCurrentView && isWidgetInCurrentPage) {
      setIsOpentResultListDefault(false)
      lodash.defer(() => {
        toggleResultPopper(true)
      })
    } else {
      setIsOpentResultListDefault(true)
    }
    //If Search widget is not in the current page or current view, close the result panel
    if (!isInCurrentView || !isWidgetInCurrentPage) {
      setIsOpentResultPopper(false)
    }
  }, [isInCurrentView, isWidgetInCurrentPage])

  useEffect(() => {
    const isLocationLoaded = !locationLoading && perLocationLoading.current
    if (isLocationLoaded) {
      toggleLocationOrRecentSearches(true, false)
    }
    perLocationLoading.current = locationLoading
  }, [isOpentResultPopper, locationLoading])

  useEffect(() => {
    if (isOpentResultPopper && appMode === AppMode.Design) {
      setIsOpentResultPopper(false)
    }
    // eslint-disable-next-line
  }, [appMode])

  useEffect(() => {
    debounceQuerySuggestionRef.current = lodash.debounce(querySuggestion, 400)
    // eslint-disable-next-line
  }, [config])

  useEffect(() => {
    /**
     * Check is has service support suggest
    */
    getPlaceholder(serviceList)
    checkIsAllLocatorSupportSuggest(serviceList)
    if (!isHasConfirmSearchByUrlParamsRef.current && serviceList) {
      confirmSearchBySearchTextInUrlHashObject(serviceList)
      isHasConfirmSearchByUrlParamsRef.current = true
    }
    // eslint-disable-next-line
  }, [serviceList])

  const confirmSearchBySearchTextInUrlHashObject = hooks.useEventCallback((serviceList) => {
    const searchStatusInUrlHashObject = getSearchStatusInUrl(id)
    const { searchText, status } = searchStatusInUrlHashObject

    if (status) {
      status.isFromSuggestion = true
    }

    if (!searchText) return

    if (!config?.datasourceConfig || config?.datasourceConfig?.length === 0) {
      updateSearchValue(searchText, status)
      confirmSearch(searchText)
      return
    }
    clearTimeout(confirmSearchByInUrlSearchTextTimeout.current)
    confirmSearchByInUrlSearchTextTimeout.current = setTimeout(() => {
      if (checkIsAllDsCreated(serviceList?.asMutable({ deep: true }), id) && getCanUseDslength() > 0) {
        updateSearchValue(searchText, status)
        confirmSearch(searchText)
      } else {
        confirmSearchBySearchTextInUrlHashObject(serviceList)
      }
    }, 300)
  })

  useEffect(() => {
    if (hasSetPreServiceList.current) {
      clearDsFilterAfterDeleteOrAddDs(serviceList)
      clearDsFilterAfterEnableFilteringChange(serviceList, preEnableFiltering.current)
    }
    preServiceList.current = serviceList
    serviceList && (hasSetPreServiceList.current = true)
    preEnableFiltering.current = config?.enableFiltering
    didMount.current = true
    // eslint-disable-next-line
  }, [serviceList, config.enableFiltering])

  const toggleLocationOrRecentSearches = (isOpen = false, isInitGetLocationStatus = true) => {
    if (isInitGetLocationStatus) {
      setIsGetLocationError(false)
    }
    if (!isOpen) {
      isFocusLocationAndRecentSearch.current = false
    }
    setOpenLocationOrRecentSearches(isOpen)
  }

  const clearDsFilterAfterEnableFilteringChange = (serviceList: IMServiceList, preEnableFiltering: boolean) => {
    if (!didMount.current) return false
    const isEnableFilteringChange = preEnableFiltering !== config?.enableFiltering

    if (isEnableFilteringChange) {
      clearTimeout(clearSearchValueTimeoutRef.current)
      clearSearchValueTimeoutRef.current = setTimeout(() => {
        clearSearchValue()
        clearSearchResult()
        for (const configId in serviceList) {
          const isItemFeatureService = serviceList[configId]?.searchServiceType === SearchServiceType.FeatureService
          if (isItemFeatureService) {
            clearFilterOfDeletedDs(serviceList[configId], id, configId, preEnableFiltering)
          }
        }
      })
    }
  }

  const clearDsFilterAfterDeleteOrAddDs = (serviceList: IMServiceList) => {
    if (!didMount.current) return false
    const preService = preServiceList.current || {}
    const configIds = getServiceConfigId(serviceList)
    const preConfigIds = getServiceConfigId(preServiceList.current)
    const deleteConfigIds = preConfigIds?.filter(id => !configIds?.includes(id)) || []
    const serviceLengthChange = Object.keys(serviceList || {}).length !== Object.keys(preService || {}).length

    if (serviceLengthChange) {
      clearTimeout(clearSearchValueTimeoutRef.current)
      clearSearchValueTimeoutRef.current = setTimeout(() => {
        clearSearchValue(false)
        clearSearchResult()
        deleteConfigIds?.forEach(configId => {
          const isItemFeatureService = preService[configId]?.searchServiceType === SearchServiceType.FeatureService
          if (isItemFeatureService) {
            clearFilterOfDeletedDs(preService[configId], id, configId, config?.enableFiltering)
          } else {
            initOutputDsItemStatus(preService[configId]?.outputDataSourceId)
          }
        })
      })
    }
  }

  const getServiceConfigId = (serviceList: IMServiceList): string[] => {
    if (!serviceList) {
      return []
    } else {
      return Object.keys(serviceList).map(id => id)
    }
  }

  const toggleSuggestionUtilityError = (open = false) => {
    setOpenUtilityErrRemindInSuggestion(open)
  }

  const toggleResultUtilityError = (open = false) => {
    setOpenUtilityErrRemindInResult(open)
  }

  /**
  * Query suggestion
  */
  const querySuggestion = hooks.useEventCallback((starchText: string) => {
    const serviceSuggestion = getSuggestions(starchText, newServiceListRef?.current?.asMutable({ deep: true }), config)
    Promise.all([serviceSuggestion]).then(allSuggestion => {
      const suggestion = allSuggestion?.[0]

      const isShowUtilityError = suggestion?.filter(item => item?.err)?.length > 0
      if (isShowUtilityError) {
        toggleSuggestionUtilityError(true)
      }

      setIsShowLoading(false)
      if (suggestion) {
        setSearchSuggestion(suggestion)
      }
      if (!isHasConfirmSearchRef.current) {
        searchValueRef.current && setIsOpenSuggestion(true)
      }
      isHasConfirmSearchRef.current = false
    }).catch((error) => {
      setIsShowLoading(false)
    })
  })

  const checkIsAllLocatorSupportSuggest = hooks.useEventCallback((newServiceList: IMServiceList) => {
    if (!didMount.current) return false
    let hasServiceSupportSuggest = false
    for (const key in newServiceList) {
      const serviceItem = newServiceList[key]
      if (serviceItem?.searchServiceType === SearchServiceType.FeatureService) {
        hasServiceSupportSuggest = true
      } else {
        if (serviceItem?.isSupportSuggest) {
          hasServiceSupportSuggest = true
        }
      }
    }
    setIsHasServiceSupportSuggest(hasServiceSupportSuggest)
  })

  /**
   * Fire callback when the text of search input changes
  */
  const onChange = (e) => {
    const value = e?.target?.value
    const isShowSuggestion = value?.length > 2
    updateSearchValue(value)
    if (isOpentResultPopper) {
      confirmSearch('', true)
    }
    toggleResultPopper(false)
    if (!isShowSuggestion || !isHasServiceSupportSuggest) {
      setIsOpenSuggestion(false)
      if (value?.length === 0) {
        confirmSearch('', true)
      }
      return false
    }
    !isShowLoading && setIsShowLoading(true)
    debounceQuerySuggestionRef.current(value)
  }

  const initResultServiceList = (newServiceList: ServiceList, initResultServiceListOption?: InitResultServiceListOption) => {
    const { configId, magicKey, isFromSuggestion } = initResultServiceListOption || {}
    let newResultServiceList = Immutable(newServiceList)
    const suggestionServiceList = {} as any
    for (const id in newResultServiceList) {
      if (id === configId && (magicKey || isFromSuggestion)) {
        magicKey && (newResultServiceList = newResultServiceList.setIn([configId, 'magicKey'], magicKey || null))
        isFromSuggestion && (newResultServiceList = newResultServiceList.setIn([configId, 'isFromSuggestion'], isFromSuggestion || null))
        suggestionServiceList[configId] = newResultServiceList[configId]
      }
    }

    if (magicKey || isFromSuggestion) {
      const isServiceItemExist = Object.keys(newServiceList).includes(configId)
      isServiceItemExist && (newResultServiceList = Immutable(suggestionServiceList))
    }

    resultServiceListRef.current = newResultServiceList?.asMutable({ deep: true })
    setResultServiceList(newResultServiceList?.asMutable({ deep: true }))
  }

  /**
   * Fire callback when clear search input
  */
  const clearSearchValue = (isFocksInput = true) => {
    updateSearchValue('')

    setIsShowLoading(false)
    toggleResultPopper(false)

    confirmSearch('', true)

    clearTimeout(inputBlurTimeoutRef.current)
    isFocksInput && searchInputRef.current?.focus()
  }

  /**
   * Set outputDs status to NotReady after clear search input
  */
  const initOutputDsStatus = hooks.useEventCallback(() => {
    for (const configId in serviceList) {
      if (serviceList[configId]?.searchServiceType === SearchServiceType.GeocodeService) {
        const outputDsId = serviceList[configId]?.outputDataSourceId
        initOutputDsItemStatus(outputDsId)
      }
    }
  })

  const initOutputDsItemStatus = (outputDsId: string) => {
    const outPutDs = getDatasource(outputDsId)
    outPutDs.selectRecordsByIds([])
    changeDsStatus(outPutDs as QueriableDataSource, DataSourceStatus.NotReady)
    const dataRecordSetChangeMessage = new DataRecordSetChangeMessage(id, RecordSetChangeType.Remove, [outputDsId])
    MessageManager.getInstance().publishMessage(dataRecordSetChangeMessage)
  }

  /**
   * Fire callback when search input focus
  */
  const onSearchInputFocus = (e) => {
    if (isFocusSuggestion.current || isFocusLocationAndRecentSearch.current) {
      isFocusLocationAndRecentSearch.current = false
      isFocusSuggestion.current = false
      return false
    }
    showRecentSearches(searchValueRef.current)
    showUseCurrentLocation(searchValueRef.current)
  }

  /**
   * Toggle result list popper
  */
  const toggleResultPopper = (isOpen: boolean) => {
    preIsOpentResultPopperRef.current = isOpen
    if (!isOpen) {
      setIsOpentResultListDefault(true)
    }
    setIsOpentResultPopper(isOpen)
  }

  /**
   * Fire callback when search input key up
  */
  const onKeyUp = e => {
    if (!e || !e.target) return
    const searchText = e?.target?.value
    //Click suggestion to get the result, then click Enter again and no longer reload
    if (e.keyCode === 13 && checkIsReloadRecords()) {
      updateSearchValue(searchText)
      confirmSearch(searchText)
    }
    checkAndFocksPopper(e)
  }

  const checkIsReloadRecords = () => {
    let isReload = true
    if (!resultServiceListRef.current) return isReload
    const currentResultServiceList = resultServiceListRef.current
    for (const configId in currentResultServiceList) {
      const serviceItem = currentResultServiceList[configId]
      isReload = !(serviceItem?.magicKey || serviceItem?.isFromSuggestion)
      if (!isReload) break
    }
    return isReload
  }

  /**
   * Fire callback when the suggestion list item is clicked.
  */
  const onSuggestionItemClick = (searchText: string, initResultServiceListOption?: InitResultServiceListOption, isUseLocationError?: boolean) => {
    if (isUseLocationError) {
      loadLocationError()
      return false
    }

    setWidgetUrlParams(searchText, initResultServiceListOption)

    updateSearchValue(searchText, initResultServiceListOption)
    confirmSearch(searchText)
    searchInputRef.current.focus()
  }

  const setWidgetUrlParams = (searchText: string, initResultServiceListOption?: InitResultServiceListOption) => {
    const searchStatus = getSearchStatusInUrl(id) || {} as any
    if (searchText) {
      searchStatus.searchText = searchText
      if (initResultServiceListOption) {
        const status = {
          configId: initResultServiceListOption?.configId
        } as any
        initResultServiceListOption?.magicKey && (status.magicKey = initResultServiceListOption?.magicKey)
        searchStatus.status = status
      }
      handleSearchWidgetUrlParamsChange(id, searchStatus)
    } else {
      if (!searchStatus?.serviceEnabledList) {
        handleSearchWidgetUrlParamsChange(id, null)
      } else {
        const newSearchStatus = {
          serviceEnabledList: searchStatus?.serviceEnabledList
        }
        handleSearchWidgetUrlParamsChange(id, newSearchStatus)
      }
    }
  }

  const loadLocationError = () => {
    searchInputRef.current?.focus()
    setIsGetLocationError(true)
    toggleLocationOrRecentSearches(true, false)
  }
  /**
   * Confirm search
  */
  const confirmSearch = hooks.useEventCallback((searchText: string, isClearSearch: boolean = false) => {
    if (isOpentResultPopper && !isClearSearch) return
    searchText = searchText?.trim()
    updateRecentSearches(searchText)
    setIsOpenSuggestion(false)
    toggleLocationOrRecentSearches(false)
    clearSelectRecordAndAction()
    handleServiceListChange(newServiceListRef.current)

    isHasConfirmSearchRef.current = true

    const updateParamsOption = {
      serviceList: resultServiceListRef.current,
      searchText: searchText,
      searchResultView: searchResultView,
      id: id
    }

    setWidgetUrlParams(searchText)

    setIsShowLoading(true)
    updateRecordsOfOutputDs(updateParamsOption).then(res => {
      setIsShowLoading(false)
      if (res?.filter(item => typeof item === 'boolean')?.length > 0) {
        toggleResultUtilityError(true)
      }

      isHasConfirmSearchRef.current = false
      if (config?.enableFiltering) {
        updateAllLayerServiceDsQueryParams(updateParamsOption)
        publishDataFilterAction()
      }
      searchText && showResult(searchText)
    }, err => {
      setIsShowLoading(false)
    })
  })

  /**
   * Clear the selected records and message actions of current search before re-searching
  */
  const clearSelectRecordAndAction = () => {
    MessageManager.getInstance().publishMessage(
      new DataRecordsSelectionChangeMessage(id, [])
    )
    if (dsIdOfSelectedResultItem) {
      const ds = getDatasource(dsIdOfSelectedResultItem) as QueriableDataSource
      ds?.selectRecordsByIds([])
    }

    initOutputDsStatus()
  }

  const handleDsIdOfSelectedResultItemChange = (dsId: string) => {
    setDsIdOfSelectedResultItem(dsId)
  }

  const publishDataFilterAction = hooks.useEventCallback(() => {
    const datasourceIds: string[] = []
    for (const configId in resultServiceList) {
      const service = resultServiceList[configId]
      let dsId: string
      if (service?.searchServiceType === SearchServiceType.FeatureService) {
        dsId = service?.useDataSource?.dataSourceId
        datasourceIds.push(dsId)
      }
    }
    MessageManager.getInstance().publishMessage(new DataSourceFilterChangeMessage(id, datasourceIds))
  })

  const showResult = (searchText: string) => {
    //Show result
    publishRecordCreateAction()
    if (searchResultView === SearchResultView.OtherWidgets) {
      if (searchText) {
        if (checkIsHasSuggestion()) {
          toOtherWidget()
        } else {
          loadRecordAndCheckIsToOtherWidget()
        }
      }
    } else {
      showResultPanel()
    }
  }

  /**
  * Load records and check is has records before jump page, if not, show no result panel
  */
  const loadRecordAndCheckIsToOtherWidget = () => {
    if (!checkIsAllRecordLoaded(resultServiceListRef.current, id)) {
      clearTimeout(checkIsToOtherWidgetTimeoutRef.current)
      checkIsToOtherWidgetTimeoutRef.current = setTimeout(() => {
        loadRecordAndCheckIsToOtherWidget()
      }, 200)
      return false
    }
    const serviceRecords = loadAllDsRecord(resultServiceListRef.current, resultMaxNumber, id)
    Promise.all([serviceRecords]).then(res => {
      let allResponse = []
      let allRecords = []
      res?.forEach(resItem => {
        allResponse = allResponse.concat(resItem)
      })
      allResponse.forEach(dsResult => {
        const records = dsResult?.records || []
        allRecords = allRecords.concat(records)
      })
      if (allRecords?.length > 0) {
        toOtherWidget()
      } else {
        showResultPanel()
      }
    })
  }

  const showResultPanel = () => {
    const recordsResult = loadAllDsRecord(resultServiceListRef.current, resultMaxNumber, id, true)
    Promise.all([recordsResult]).then(res => {
      let allResponse = []
      res?.forEach(resItem => {
        allResponse = allResponse.concat(resItem)
      })
      publishRecordCreatedMessageAction(id, allResponse, RecordSetChangeType.CreateUpdate)
    })
    toggleResultPopper(true)
  }

  const checkIsHasSuggestion = () => {
    let suggestion = []
    searchSuggestion.forEach(item => {
      suggestion = suggestion.concat(item?.suggestionItem)
    })
    return suggestion.length > 0
  }

  /**
   * Update Recent searches
  */
  const updateRecentSearches = (searchText: string) => {
    //Save recent searchs
    const recentSearchsOption = {
      searchText: searchText,
      id: id,
      recentSearchesMaxNumber: recentSearchesMaxNumber,
      isShowRecentSearches: isShowRecentSearches
    }
    setRecentSearches(recentSearchsOption)
  }

  /**
   * Show result in other widget
  */
  const toOtherWidget = () => {
    if (!linkRef?.current) {
      return false
    }
    linkRef?.current?.click()
  }

  /**
   * Load geocode records and publish records created message action
  */
  const publishRecordCreateAction = () => {
    if (!checkIsAllRecordLoaded(resultServiceListRef.current, id)) {
      clearTimeout(checkIsAllDsStatusLoadedTimeoutRef.current)
      checkIsAllDsStatusLoadedTimeoutRef.current = setTimeout(() => {
        publishRecordCreateAction()
      }, 200)
      return false
    }
    const maxRecordNumber = searchResultView === SearchResultView.ResultPanel ? resultMaxNumber : 100
    const geocodeRecords = loadAllDsRecord(resultServiceListRef.current, maxRecordNumber, id, true)
    Promise.all([geocodeRecords]).then(res => {
      let allResponse = []
      res?.forEach(resItem => {
        allResponse = allResponse.concat(resItem)
      })
      publishRecordCreatedMessageAction(id, allResponse, RecordSetChangeType.CreateUpdate)
    })
  }

  const getLinkToOption = (linkParam) => {
    let target: LinkTarget
    let linkTo: LinkTo
    if (linkParam?.linkType) {
      target = linkParam?.openType
      linkTo = {
        linkType: linkParam?.linkType
      } as LinkResult

      linkTo.value = linkParam?.value
    }
    return {
      linkTo: linkTo,
      target: target
    }
  }

  const linkToOption = useMemo(() => getLinkToOption(linkParam), [linkParam])

  /**
   * Clear Recent search
  */
  const clearRecentSearche = () => {
    clearRecentSearches(id)
    setRecentSearchesData([])
    setOpenLocationOrRecentSearches(false)
  }

  /**
   * Fire callback when the text of search input changes
  */
  const updateSearchValue = (searchText: string, initResultServiceListOption?: InitResultServiceListOption) => {
    setSearchSuggestion([])
    setSearchValue(searchText)
    searchValueRef.current = searchText
    setQuerySQL(searchText, initResultServiceListOption)
  }
  /**
    * Set query SQL according to search text
  */
  const setQuerySQL = hooks.useEventCallback((searchText: string, initResultServiceListOption?: InitResultServiceListOption) => {
    let newServiceList = serviceList
    searchText = searchText?.trim()
    for (const configId in serviceList) {
      const dsId = serviceList[configId]?.useDataSource?.dataSourceId
      if (serviceList[configId].searchServiceType === SearchServiceType.GeocodeService || !checkIsDsCreated(dsId)) continue
      const ds = getDatasource(dsId)
      const searchFields = serviceList[configId].searchFields?.asMutable({ deep: true }) || []
      const searchExact = serviceList[configId].searchExact || false
      const SQL = getSQL(searchText, searchFields, ds, searchExact)
      const SuggestionSQL = getSQL(searchText, searchFields, ds, false)
      newServiceList = newServiceList
        .setIn([configId, 'SQL'], SQL)
        .setIn([configId, 'SuggestionSQL'], SuggestionSQL)
        .setIn([configId, 'searchText'], searchText)
    }
    newServiceListRef.current = newServiceList
    initResultServiceList(newServiceList?.asMutable({ deep: true }), initResultServiceListOption)
  })

  /**
   * Check is show recent searches
  */
  const showRecentSearches = (searchText?: string) => {
    if (!searchText && isShowRecentSearches) {
      const recentSearches = getRecentSearches(id)
      const recentSearchesItem = recentSearches.map((searchValue) => {
        return {
          suggestionHtml: searchValue,
          suggestion: searchValue,
          isRecentSearche: true
        }
      })
      setRecentSearchesData([{
        suggestionItem: recentSearchesItem,
        layer: null,
        icon: null
      }])
      toggleLocationOrRecentSearches(true)
    }
  }

  const showUseCurrentLocation = (searchText?: string) => {
    if (!searchText && config?.isUseCurrentLoation) {
      toggleLocationOrRecentSearches(true)
      if (!config?.isShowRecentSearches) {
        setRecentSearchesData([{
          suggestionItem: [],
          layer: null,
          icon: null
        }])
      }
    }
  }

  const suffix = () => {
    return (
      <div className='d-flex align-items-center'>
        {(isShowLoading || locationLoading) && <div className='loading-con mr-1'/>}
        {(searchValue && searchValue?.length > 0) &&
          <Button icon type='tertiary' size='sm' title={nls('clear')} onClick={() => { clearSearchValue() }}>
            <CloseOutlined/>
          </Button>}
      </div>
    )
  }

  const prefix = () => {
    return config.arrangementStyle === ArrangementStyle.Style2 ? <SearchOutlined className='input-prefix-icon'/> : null
  }

  /**
   * Get placeholder of search input
  */
  const getPlaceholder = hooks.useEventCallback((newServiceList: IMServiceList) => {
    let servicePlaceholder
    const canUseDslength = getCanUseDslength(newServiceList)
    for (const configId in newServiceList) {
      servicePlaceholder = newServiceList?.[configId]?.hint && newServiceList?.[configId]?.hint
    }

    const multipleSearchPlaceholder = config?.hint || nls('findAddressOrPlace')
    servicePlaceholder = servicePlaceholder || nls('findAddressOrPlace')
    const newPlaceholder = (canUseDslength !== 1) ? multipleSearchPlaceholder : servicePlaceholder
    setSearchPlaceholder(newPlaceholder)
  })

  const getCanUseDslength = hooks.useEventCallback((newServiceList?: IMServiceList) => {
    newServiceList = newServiceList || serviceList
    return getJsonLength(newServiceList)
  })

  const onSearchButtonClick = (searchValue: string) => {
    checkIsReloadRecords() && confirmSearch(searchValue)
  }

  const setSuggestionFirstItem = (ref: any) => {
    suggestionFirstItem.current = ref
  }

  const setRencentSearchFirstItem = (ref: any) => {
    recentSearchFirstItem.current = ref
  }

  const setResultFirstItem = (ref: any) => {
    resultFirstItem.current = ref
  }

  const checkAndFocksPopper = (e) => {
    if (e.keyCode === 40 && suggestionFirstItem) {
      if (isOpenSuggestion) {
        suggestionFirstItem?.current?.focus()
      } else if (isOpentResultPopper) {
        resultFirstItem?.current?.focus()
      } else if (openLocationOrRecentSearches) {
        recentSearchFirstItem?.current?.focus()
        isFocusLocationAndRecentSearch.current = true
      }
    }
  }

  const inputConKeyup = (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const isSuggestionOpen = checkIsOpenSuggestionPopper()
      isFocusSuggestion.current = isSuggestionOpen
      isFocusLocationAndRecentSearch.current = openLocationOrRecentSearches
    }
    checkAndFocksPopper(e)
  }

  const checkIsOpenSuggestionPopper = () => {
    if (locationLoading) return true
    if (isShowLoading || isOpentResultPopper) return false
    let isOpen = false
    if (config?.maxSuggestions > 0) {
      isOpen = isOpenSuggestion && isHasServiceSupportSuggest
    }

    if (!isOpen) {
      isFocusSuggestion.current = false
    }
    return isOpen
  }

  const handleInputBlur = (e) => {
    inputBlurTimeoutRef.current = setTimeout(() => {
      if (!isFocusSuggestion.current) {
        setIsOpenSuggestion(false)
      }
      if (!locationLoadingRef.current && !isFocusLocationAndRecentSearch.current) {
        toggleLocationOrRecentSearches(false)
      }
    }, 200)
  }

  const toggleSuggestion = () => {
    setIsOpenSuggestion(false)
  }

  const handleLocationLoadingChange = (loading: boolean) => {
    if (!loading) {
      setTimeout(() => {
        setLocationLoading(loading)
        locationLoadingRef.current = loading
      }, 300)
    } else {
      setLocationLoading(loading)
      locationLoadingRef.current = loading
    }
  }

  const checkIsShowLocationOrRecentSearch = () => {
    return !searchValue && (config?.isUseCurrentLoation || config?.isShowRecentSearches || !locationLoading)
  }

  return (
    <div className={`h-100 align-items-center position-relative d-flex flex-grow-1 ${className || ''} arrangement-${config.arrangementStyle}`} css={STYLE}>
      <div className='h-100 flex-grow-1 search-input-con'>
        <div className='h-100 w-100' onKeyDown={inputConKeyup}>
          {isShowSearchInput && <TextInput
            value={searchValue || ''}
            onChange={onChange}
            onFocus={onSearchInputFocus}
            onKeyUp={onKeyUp}
            onBlur={handleInputBlur}
            className={classNames('h-100 w-100', { 'no-border-left': config?.datasourceConfig?.length > 1 })}
            suffix={suffix()}
            prefix={prefix()}
            placeholder={searchPlaceholder}
            title={searchValue || searchPlaceholder}
            ref={searchInputRef}
          />}
        </div>
        {searchValue && <SuggestionList
          canUseOutoutDsLength={getCanUseDslength()}
          isOpen={checkIsOpenSuggestionPopper()}
          reference={reference}
          searchText={searchValue}
          searchSuggestion={searchSuggestion}
          toggel={toggleSuggestion}
          onRecordItemClick={onSuggestionItemClick}
          setSuggestionFirstItem={setSuggestionFirstItem}
          id={id}
          config={config}
          toggleSuggestionUtilityError={toggleSuggestionUtilityError}
          openUtilityErrRemindInSuggestion={openUtilityErrRemindInSuggestion}
          searchInputRef={searchInputRef}
          serviceList={serviceList}
        />}
        {checkIsShowLocationOrRecentSearch() && <LocationAndRecentSearch
          serviceList={getJsonLength(resultServiceList) > 0 ? Immutable(resultServiceList) : serviceList }
          isOpen={openLocationOrRecentSearches || locationLoading}
          reference={reference}
          isGetLocationError={isGetLocationError}
          recentSearchesData={recentSearchesData}
          toggel={toggleSuggestion}
          onRecordItemClick={onSuggestionItemClick}
          clearSearches={clearRecentSearche}
          setSuggestionFirstItem={setRencentSearchFirstItem}
          id={id}
          config={config}
          searchInputRef={searchInputRef}
          locationLoading={locationLoading}
          handleLocationLoadingChange={handleLocationLoadingChange}
        />}
        {isOpentResultPopper && <ResultList
          serviceList={Immutable(resultServiceList)}
          config={config}
          reference={reference}
          searchText={searchValue}
          id={id}
          setResultFirstItem={setResultFirstItem}
          isOpentResultListDefault={isOpentResultListDefault}
          searchInputRef={searchInputRef}
          searchResult={searchResult}
          selectionList={selectionList}
          openUtilityErrRemindInResult={openUtilityErrRemindInResult}
          handleDsIdOfSelectedResultItemChange={handleDsIdOfSelectedResultItemChange}
          toggleResultUtilityError={toggleResultUtilityError}
        />}
      </div>
      {config.arrangementStyle !== ArrangementStyle.Style2 && <Button
        className='search-button h-100'
        type={config.arrangementStyle === ArrangementStyle.Style3 ? 'tertiary' : 'primary'}
        icon
        onClick={() => { onSearchButtonClick(searchValue) }} title={nls('SearchLabel')}
      >
        <SearchOutlined/>
      </Button>}

      {searchResultView === SearchResultView.OtherWidgets && <div className='search-link-con'>
        <Link
          ref={linkRef}
          to={linkToOption?.linkTo}
          target={linkToOption?.target}
          queryObject={queryObject}
        />
      </div>}
    </div>
  )
}

export default SearchInput
