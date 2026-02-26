/** @jsx jsx */
import { React, jsx, type QueriableDataSource, classNames, type DataRecord, Immutable, type ImmutableObject, i18n, MessageManager, DataRecordsSelectionChangeMessage, hooks, ReactRedux, type IMState } from 'jimu-core'
import { Icon, Button, DropdownItem } from 'jimu-ui'
import { type IMConfig, type IMServiceList, type IMSearchResult, SearchResultStyle, DEFAULT_POPPER_OFFSET, type IMSelectionList } from '../../config'
import defaultMessage from '../translations/default'
import { getDatasourceConfigItemByConfigId, getJsonLength, getDatasource, loadAllDsRecord, checkIsAllRecordLoaded } from '../utils/utils'
import { useTheme } from 'jimu-theme'
import { DownOutlined } from 'jimu-icons/outlined/directional/down'
import { UpOutlined } from 'jimu-icons/outlined/directional/up'
import ResultPopper from './resultPopper'
import UtilityErrorRemind from './utility-remind'
const { useEffect, useRef } = React
interface DisplayRecord {
  value: string[]
  configId: string
  outputDsId: string
  recordId: string
  isGeocodeRecords: boolean
  localDsId?: string
}

interface DisplayRecordData {
  [configId: string]: DisplayRecord[]
}

interface DisplayRecords {
  [configId: string]: DataRecord[]
}

interface SelectRecordsOption {
  isActive: boolean
  key: string
  recordId: string
  dsId: string
  configId: string
}

type IMDisplayRecordData = ImmutableObject<DisplayRecordData>

interface ResultListProps {
  serviceList: IMServiceList
  searchText: string
  reference: any
  id: string
  isOpentResultListDefault: boolean
  config: IMConfig
  searchResult: IMSearchResult
  className?: string
  searchInputRef?: any
  selectionList: IMSelectionList
  openUtilityErrRemindInResult: boolean
  setResultFirstItem: (ref) => void
  handleDsIdOfSelectedResultItemChange: (dsId: string) => void
  toggleResultUtilityError: (open?: boolean) => void
}

const ResultList = (props: ResultListProps) => {
  const nls = hooks.useTranslation(defaultMessage)
  const { reference, searchText, id, config, serviceList, isOpentResultListDefault, searchInputRef, searchResult, selectionList, openUtilityErrRemindInResult, toggleResultUtilityError, setResultFirstItem, handleDsIdOfSelectedResultItemChange } = props
  const { resultMaxNumber } = config
  const selectedRecordKey = useRef([] as string[])
  const isDataLoaded = useRef(false)
  const dropdownMenuRef = useRef<HTMLDivElement>(null)
  const isHasSetFirstItem = useRef<boolean>(false)
  const displayRecordRef = useRef<IMDisplayRecordData>(Immutable({}) as IMDisplayRecordData)
  const displayRecordsRef = useRef<DisplayRecords>({} as DisplayRecords)

  const isRTL = ReactRedux.useSelector((state: IMState) => {
    return state.appContext.isRTL
  })

  let firstRecord: DisplayRecord = {} as DisplayRecord
  const theme = useTheme()

  const [displayRecord, setDisplayRecord] = React.useState(Immutable({}) as IMDisplayRecordData)
  const [isShowResultList, setIsShowResultList] = React.useState(isOpentResultListDefault)
  const [isHasAutoSelectFirstRecord, setDsHasAutoSelectFirstRecord] = React.useState(false)
  const [searchResultStyle, setSearchResultStyle] = React.useState(SearchResultStyle.Classic)
  const [isNoResult, setIsNoResult] = React.useState(false)
  const [version, setVersion] = React.useState(0)
  const [offset, setOffset] = React.useState(DEFAULT_POPPER_OFFSET)

  useEffect(() => {
    isDataLoaded.current = false
    if (checkIsAllRecordLoaded(serviceList?.asMutable({ deep: true }), id)) {
      loadRecords()
    }
    // eslint-disable-next-line
  }, [searchResult])

  useEffect(() => {
    checkIsNoResult(displayRecord)
    // eslint-disable-next-line
  }, [displayRecord])

  useEffect(() => {
    if (config?.searchResultStyle && config?.searchResultStyle !== searchResultStyle) {
      setSearchResultStyle(config?.searchResultStyle)
    }
    // eslint-disable-next-line
  }, [config])

  useEffect(() => {
    selectedRecordKey.current = []
  }, [searchText])

  useEffect(() => {
    getOffset(searchResultStyle, isShowResultList, isNoResult)
    // eslint-disable-next-line
  }, [searchResultStyle, isShowResultList, isNoResult])

  /**
   * Load records by outputDatasource
  */
  const loadRecords = () => {
    const serviceRecords = loadAllDsRecord(serviceList?.asMutable({ deep: true }), resultMaxNumber, id)
    Promise.all([serviceRecords]).then(res => {
      isDataLoaded.current = true
      let newDisplayRecord = displayRecord || Immutable({}) as IMDisplayRecordData
      let allResponse = []
      res?.forEach(resItem => {
        allResponse = allResponse.concat(resItem)
      })
      const newDisplayRecords: any = {}
      allResponse.forEach(dsResult => {
        const { records, configId, dsId, isGeocodeRecords, localDsId } = dsResult
        newDisplayRecords[configId] = records
        const disPlayData = getDisplayRecords(records, configId, dsId, isGeocodeRecords, localDsId)
        newDisplayRecord = newDisplayRecord.setIn([configId], disPlayData)
      })
      displayRecordRef.current = newDisplayRecord
      setDisplayRecord(newDisplayRecord)
      displayRecordsRef.current = newDisplayRecords
      setVersion(version + 1)
      autoSelectFirstRecord()
    })
  }

  /**
   * Render result list
  */
  const renderResultList = () => {
    const recordElementdata = []
    isHasSetFirstItem.current = null
    for (const configId in displayRecord) {
      const displayItem = displayRecord?.asMutable({ deep: true })?.[configId]
      const datasourceConfigItem = getDatasourceConfigItemByConfigId(config, configId)
      const label = datasourceConfigItem?.label
      const icon = datasourceConfigItem?.icon
      const currentOutputNumber = getJsonLength(serviceList)
      const list = (
        <div key={`${configId}_${label}_con`} role='group' title='label' aria-label={label}>
          {displayItem.length > 0 && <div>
            {currentOutputNumber > 1 &&
              <Button role='button' className='source-label-con jimu-outline-inside' disabled={true} key={`${configId}_${label}`} title={label}>
                {icon && <Icon className='mr-2' color={theme?.sys.color?.primary.main} size={16} icon={icon?.svg}/> }
                {label}
              </Button>
            }
            {renderResultItem(displayItem, selectionList, checkIsShowPadding())}
          </div>}
        </div>
      )
      recordElementdata.push(list)
    }
    return recordElementdata
  }

  const checkIsShowPadding = () => {
    const currentOutputNumber = getJsonLength(serviceList)
    if (currentOutputNumber < 2) {
      return false
    }

    // The total number of icons
    let iconNumber = 0
    //when only one source has records, and the ds item has an icon, padding should also be added
    let numberOfSourceWithRecordsAndIcon = 0
    for (const configId in displayRecord) {
      const datasourceConfigItem = getDatasourceConfigItemByConfigId(config, configId)
      const icon = datasourceConfigItem?.icon
      if (icon) {
        iconNumber += 1
      }
      if (displayRecord[configId]?.length > 0 && icon) {
        numberOfSourceWithRecordsAndIcon += 1
      }
    }
    return numberOfSourceWithRecordsAndIcon > 0 && iconNumber > 0
  }

  /**
   * Render result item
  */
  const renderResultItem = hooks.useEventCallback((displayData: DisplayRecord[], selectionList: IMSelectionList, isShowPadding = false) => {
    return displayData?.map((displayDataItem, index) => {
      const { configId, value, recordId, outputDsId } = displayDataItem
      const key = getItemKey(configId, recordId)
      const isSelected = selectionList?.asMutable({ deep: true })?.[configId]?.includes(recordId)
      const datasourceConfigItem = getDatasourceConfigItemByConfigId(config, configId)
      const icon = datasourceConfigItem?.icon
      const iconColor = isSelected ? theme?.ref.palette?.white : theme?.sys.color?.primary.main
      const currentOutputNumber = getJsonLength(serviceList)

      return (
        <Button
          className={classNames('d-flex align-items-center jimu-outline-inside', { 'item-p-l': isShowPadding })}
          key={key}
          role='button'
          active={isSelected}
          title={value.join(', ')}
          ref={ref => { setFirstItemRef(index, ref) }}
          onClick={() => {
            onSelectRecord({
              isActive: isSelected,
              key: key,
              recordId: recordId,
              dsId: outputDsId,
              configId: configId
            })
          }}
        >
          {(icon && currentOutputNumber === 1) && <Icon className='mr-2' color={iconColor} size={16} icon={icon?.svg}/> }
          <div>{value.join(', ')}</div>
        </Button>
      )
    })
  })

  const setFirstItemRef = (index: number, ref) => {
    if (index === 0 && !isHasSetFirstItem.current) {
      setResultFirstItem(ref)
      isHasSetFirstItem.current = true
    }
  }

  const onSelectRecord = hooks.useEventCallback((option: SelectRecordsOption) => {
    const { isActive, recordId, dsId, configId } = option
    const localDsId = displayRecordRef.current?.[configId]?.[0]?.localDsId
    const isGeocodeRecords = displayRecordRef.current?.[configId]?.[0]?.isGeocodeRecords
    const datasourceId = isGeocodeRecords ? dsId : localDsId
    const ds = getDatasource(datasourceId) as QueriableDataSource

    //Publish message action
    const records = !isActive ? getRecordsByRecordsId(configId, recordId) : []
    // const widgetId = isGeocodeRecords ? id : localId
    MessageManager.getInstance().publishMessage(
      new DataRecordsSelectionChangeMessage(id, records)
    )
    handleDsIdOfSelectedResultItemChange(recordId ? dsId : null)
    if (recordId) {
      !isActive && clearOtherDsSlectedRecords(configId)
      !isActive ? ds?.selectRecordsByIds([recordId]) : ds?.selectRecordsByIds([])
    }
  })

  const clearOtherDsSlectedRecords = (currentSelectConfigId: string) => {
    const displayRecord = displayRecordRef.current
    for (const configId in displayRecord) {
      if (currentSelectConfigId === configId) {
        continue
      } else {
        const dsId = displayRecord[configId]?.[0]?.outputDsId
        const localDsId = displayRecord?.[configId]?.[0]?.localDsId
        const isGeocodeRecords = displayRecord?.[configId]?.[0]?.isGeocodeRecords
        const datasourceId = isGeocodeRecords ? dsId : localDsId
        const ds = getDatasource(datasourceId) as QueriableDataSource
        ds && ds.selectRecordsByIds([])
      }
    }
  }

  const getRecordsByRecordsId = (configId: string, recordId: string): DataRecord[] => {
    const records = displayRecordsRef.current?.[configId] || []
    const fieldRecord = records?.filter(record => record?.getId() === recordId)
    return fieldRecord || []
  }

  /**
   * Get display record list by field name
  */
  const getDisplayRecords = (records: DataRecord[], configId: string, dsId: string, isGeocodeRecords: boolean, localDsId?: string): DisplayRecord[] => {
    const displayFields = serviceList?.[configId]?.displayFields || []
    const displayRecordItem: DisplayRecord[] = []
    const intl = i18n.getIntl()
    records?.forEach(record => {
      const valueData = []
      displayFields.forEach(field => {
        const fieldValue = record.getFormattedFieldValue(field.jimuName, intl) as any
        const isAvailable = fieldValue || fieldValue === 0
        isAvailable && valueData.push(fieldValue)
      })
      const displayRecord: DisplayRecord = {
        value: valueData,
        configId: configId,
        outputDsId: dsId,
        recordId: record?.getId(),
        isGeocodeRecords: isGeocodeRecords,
        localDsId: localDsId
      }
      displayRecordItem.push(displayRecord)
      initFirstRecord(displayRecord)
    })
    return displayRecordItem
  }

  const initFirstRecord = (displayItem: DisplayRecord) => {
    if (!firstRecord?.recordId && displayItem.recordId) {
      firstRecord = displayItem
    }
  }

  /**
   * Get key of record item element
  */
  const getItemKey = (configId: string, recordId: string) => {
    return `${configId}_${recordId}`
  }

  /**
   * Auto select first result
  */
  const autoSelectFirstRecord = () => {
    const isAllDsLoaded = checkIsAllRecordLoaded(serviceList?.asMutable({ deep: true }), id)
    if (!config?.isAutoSelectFirstResult || !firstRecord?.recordId || isHasAutoSelectFirstRecord || !isAllDsLoaded) return
    const { configId, recordId, outputDsId } = firstRecord
    const firstRecordKey = getItemKey(configId, recordId)
    onSelectRecord({
      isActive: false,
      key: firstRecordKey,
      recordId: recordId,
      dsId: outputDsId,
      configId: configId
    })
    setDsHasAutoSelectFirstRecord(true)
  }

  const onShowResultButtonclick = () => {
    getOffset(searchResultStyle, !isShowResultList, isNoResult)
    setIsShowResultList(!isShowResultList)
    setVersion(version + 1)
  }

  const checkIsNoResult = (displayRecord: IMDisplayRecordData) => {
    let recordLength = 0
    for (const configId in displayRecord) {
      const length = displayRecord?.[configId]?.length || 0
      recordLength += length
    }
    const serviceLength = getJsonLength(serviceList)
    if (serviceLength === 0) {
      setIsNoResult(true)
    } else {
      setIsNoResult(recordLength === 0 && isDataLoaded.current)
    }
  }

  const toggleResultListPopper = (e) => {
    isShowResultList && setIsShowResultList(false)
  }

  const getPopperConClass = (): string => {
    if (searchResultStyle !== SearchResultStyle.Compact || isNoResult) {
      return ''
    }
    if (isShowResultList) {
      return 'result-list-con-compact-open'
    } else {
      return 'result-list-con-compact-close'
    }
  }

  const getOffset = (searchResultStyle: SearchResultStyle, isShowResultList: boolean, isNoResult: boolean) => {
    let newOffset = DEFAULT_POPPER_OFFSET
    if (searchResultStyle === SearchResultStyle.Compact) {
      if (!isShowResultList && !isNoResult) {
        const left = (reference?.current?.clientWidth / 2 - 15) || 0
        newOffset = isRTL ? [-left, 0] : [left, 0]
      } else {
        newOffset = DEFAULT_POPPER_OFFSET
      }
    } else {
      newOffset = DEFAULT_POPPER_OFFSET
    }
    setOffset(newOffset)
  }

  return (
    <div role='group' aria-label={nls('searchResults')}>
      <ResultPopper
        isOpen={true}
        isFocusWidtSearchInput
        autoFocus={false}
        reference={reference}
        searchInputRef={searchInputRef}
        toggle={toggleResultListPopper}
        id={id}
        offset={offset}
        version={version}
        className={classNames('result-list-con', getPopperConClass())}
      >
        <div className='result-list-content'>
          {!openUtilityErrRemindInResult && <div ref={dropdownMenuRef}>
            {isNoResult && <Button role='button' className='text-center' disabled={true} title={nls('noResult', { searchText: searchText })}>{nls('noResult', { searchText: searchText })}</Button>}

            {!isNoResult && <div>
              {searchResultStyle === SearchResultStyle.Classic && <div>
                <Button role='button' className='d-flex align-items-center show-result-button jimu-outline-inside' onClick={onShowResultButtonclick} title={nls('searchResults')}>
                  <div className='flex-grow-1 font-weight-bold'>{nls('searchResults')}</div>
                  {(!isShowResultList && !!searchText) ? <DownOutlined/> : <UpOutlined/>}
                </Button>
                {isShowResultList && <DropdownItem divider={true} />}
              </div>}

              {isShowResultList && <div>
                {renderResultList()}
              </div>}

              {searchResultStyle === SearchResultStyle.Compact && <div className='show-result-button-style2-con'>
                {isShowResultList && <DropdownItem divider={true} />}
                <Button
                  role='button'
                  className='d-flex align-items-center show-result-button show-result-button-style2 jimu-outline-inside'
                  onClick={onShowResultButtonclick}
                  title={nls('searchResults')}
                >
                  {(!isShowResultList && !!searchText) ? <DownOutlined size={10}/> : <UpOutlined size={10}/>}
                </Button>
            </div>}
            </div>}
          </div>}
          {openUtilityErrRemindInResult && <UtilityErrorRemind open={openUtilityErrRemindInResult} serviceList={serviceList} toggleUtilityErrorRemind={toggleResultUtilityError}/>}
        </div>
      </ResultPopper>
    </div>
  )
}
export default ResultList
