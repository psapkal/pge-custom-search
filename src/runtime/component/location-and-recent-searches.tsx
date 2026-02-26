/** @jsx jsx */
import { React, jsx, esri, classNames, hooks } from 'jimu-core'
import { DropdownItem, Button, defaultMessages as jimuiDefaultMessage } from 'jimu-ui'
import { type Suggestion, type IMServiceList, type InitResultServiceListOption, type IMConfig } from '../../config'
import defaultMessage from '../translations/default'
import { TrashOutlined } from 'jimu-icons/outlined/editor/trash'
import CurrentLocation from './use-current-location'
import ResultPopper from './resultPopper'
const { useRef } = React
interface SearchSettingProps {
  isOpen: boolean
  reference: any
  recentSearchesData: Suggestion[]
  className?: string
  serviceList: IMServiceList
  config: IMConfig
  searchInputRef?: any
  id: string
  locationLoading: boolean
  isGetLocationError: boolean
  toggel?: () => void
  onRecordItemClick: (searchText: string, initResultServiceListOption?: InitResultServiceListOption, isUseLocationError?: boolean) => void
  clearSearches: () => void
  setSuggestionFirstItem: (ref) => void
  handleLocationLoadingChange: (loading: boolean) => void
}
const Sanitizer = esri.Sanitizer
const sanitizer = new Sanitizer()

const LocationAndRecentSearch = (props: SearchSettingProps) => {
  const nls = hooks.useTranslation(defaultMessage, jimuiDefaultMessage)
  const {
    className, reference, recentSearchesData, isOpen, isGetLocationError, serviceList, config, id, searchInputRef, locationLoading,
    toggel, onRecordItemClick, clearSearches, setSuggestionFirstItem, handleLocationLoadingChange
  } = props

  const isHasSetFirstItem = useRef<boolean>(false)

  const handelRecendSearchItemClick = (searchText: string, initResultServiceListOption?: InitResultServiceListOption) => {
    const { configId, isFromSuggestion, magicKey } = initResultServiceListOption || {}
    if (configId && (isFromSuggestion || magicKey)) {
      onRecordItemClick(searchText, initResultServiceListOption)
    } else {
      onRecordItemClick(searchText)
    }
  }

  const renderRecentSearchElement = () => {
    isHasSetFirstItem.current = null
    return recentSearchesData?.map((layerSuggestion, index) => {
      return (
        <div key={`${layerSuggestion?.layer}-${index}`} role='group' aria-label={layerSuggestion?.layer}>
          {renderRecentSearchItemElement(layerSuggestion)}
        </div>
      )
    })
  }

  const renderRecentSearchItemElement = (recentSearch: Suggestion) => {
    const recentSearchItem = recentSearch?.suggestionItem
    return recentSearchItem?.map((item, index) => {
      const recentSearchHtml = sanitizer.sanitize(
        item.suggestionHtml
      )
      const initResultServiceListOption = {
        configId: item?.configId,
        isFromSuggestion: item?.isFromSuggestion,
        magicKey: item?.magicKey
      }
      return (
        <Button
          className={classNames('d-flex align-items-center py-2 jimu-outline-inside')}
          key={`${recentSearch?.layer}${index}`}
          title={item.suggestion}
          role='button'
          onClick={() => {
            handelRecendSearchItemClick(item.suggestion, initResultServiceListOption)
          }}
          ref={ref => { setFirstItemRef(index, ref) }}
        >
          <div className='flex-grow-1' dangerouslySetInnerHTML={{ __html: recentSearchHtml }}></div>
        </Button>
      )
    })
  }

  const setFirstItemRef = (index: number, ref) => {
    if (index === 0 && !isHasSetFirstItem.current) {
      setSuggestionFirstItem(ref)
      isHasSetFirstItem.current = true
    }
  }

  return (
    <div>
      <ResultPopper
        isOpen={isOpen}
        autoFocus={false}
        reference={reference}
        searchInputRef={searchInputRef}
        isFocusWidtSearchInput
        toggle={toggel}
        id={id}
        className={classNames('result-list-con suggestion-list-con', className)}
      >
        {config.isUseCurrentLoation && <CurrentLocation
          serviceList={serviceList}
          isShowCurrentLocation={true}
          onLocationChange={onRecordItemClick}
          locationLoading={locationLoading}
          isGetLocationError={isGetLocationError}
          handleLocationLoadingChange={handleLocationLoadingChange}
        />}

        {renderRecentSearchElement()}

        {(config.isShowRecentSearches && recentSearchesData[0]?.suggestionItem?.length > 0) && <DropdownItem divider={true} />}
        {(config.isShowRecentSearches && recentSearchesData[0]?.suggestionItem?.length > 0) && <Button role='button' className='clear-recent-search-con jimu-outline-inside' title={nls('clearRecentSearches')} onClick={clearSearches}>
          <TrashOutlined className='mr-2'/>
          {nls('clearRecentSearches')}
        </Button>}
      </ResultPopper>
    </div>
  )
}

export default LocationAndRecentSearch
