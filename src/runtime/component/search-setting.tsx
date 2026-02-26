/** @jsx jsx */
import { React, css, jsx, polished, type ImmutableArray, type UseDataSource, hooks, DataSourceStatus, getAppStore } from 'jimu-core'
import { Checkbox, Dropdown, DropdownButton, DropdownMenu, DropdownItem, Alert, defaultMessages as jimuiDefaultMessage } from 'jimu-ui'
import { type IMConfig, type NewDatasourceConfigItem, type IMDatasourceCreatedStatus, SearchServiceType } from '../../config'
import defaultMessage from '../translations/default'
import { DownOutlined } from 'jimu-icons/outlined/directional/down'
import { UpOutlined } from 'jimu-icons/outlined/directional/up'
import { handleSearchWidgetUrlParamsItemChange } from '../utils/utils'
const { useRef, useState, useEffect } = React

interface SearchSettingProps {
  config: IMConfig
  datasourceConfig: ImmutableArray<NewDatasourceConfigItem>
  onDatasourceConfigChange: (newDatasourceConfig: ImmutableArray<NewDatasourceConfigItem>) => void
  dsStatus: IMDatasourceCreatedStatus
  className?: string
  useDataSources?: ImmutableArray<UseDataSource>
  id: string
}

const STYLE = css`
& {
  box-sizing: border-box;
  width: ${polished.rem(32)};
}
.setting-dropdown-button {
  height: ${polished.rem(32)};
  border-radius: 0;
  svg {
    margin: 0 !important;
  }
}
&.ds-setting-Style1 {
  .setting-dropdown-button {
    border-radius: ${polished.rem(4)} 0 0 ${polished.rem(4)};
  }
}
&.ds-setting-Style2 {
  & {
    margin-right: ${polished.rem(4)};
  }
  .setting-dropdown-button {
    border-radius: 50%;
  }
}
&.ds-setting-Style3 {
  .setting-dropdown-button {
    background: none;
    border: none;
  }
}
`

const SearchSetting = (props: SearchSettingProps) => {
  const nls = hooks.useTranslation(defaultMessage, jimuiDefaultMessage)

  const [isCheckAll, setIsCheckAll] = useState(true)
  const [isCheckPart, setIsCheckPart] = useState(false)
  const [isOpen, setIsOpen] = React.useState(false)

  const { className, datasourceConfig, dsStatus, config, id, useDataSources, onDatasourceConfigChange } = props

  const dropdownMenuRef = useRef<HTMLDivElement>(null)
  const focusInteractiveElementTimeOutRef = useRef(null)

  const setSearchStatusInUrl = (datasourceConfig: ImmutableArray<NewDatasourceConfigItem>) => {
    const serviceEnabledList = []
    datasourceConfig?.forEach(item => {
      if (item.enable) {
        serviceEnabledList.push(item.configId)
      }
    })

    handleSearchWidgetUrlParamsItemChange(id, 'serviceEnabledList', serviceEnabledList)
  }

  const toggleSearchSetting = (e) => {
    const target = e?.target
    if (dropdownMenuRef?.current?.contains(target)) {
      return false
    }
    const isTargetInteractiveElement = checkElementInteractiveStatus(target, e)
    if (isTargetInteractiveElement && isOpen) {
      clearTimeout(focusInteractiveElementTimeOutRef.current)
      focusInteractiveElementTimeOutRef.current = setTimeout(() => {
        target?.focus()
      }, 200)
    }
    setIsOpen(!isOpen)
  }

  const checkElementInteractiveStatus = (target, evt): boolean => {
    if (!target) return false
    const zIndex = target?.getAttribute('z-index')
    const role = target?.role
    const tagName = (target && target.tagName) || ''
    const isButton = tagName.toLowerCase() === 'button' || role === 'button'
    const isInput = tagName.toLowerCase() === 'input' || role === 'input'
    const isLink = tagName.toLowerCase() === 'a' || evt.exbEventType === 'linkClick'
    const isInteractiveElement = zIndex ? zIndex > -1 : false
    return isButton || isLink || isInteractiveElement || isInput
  }

  useEffect(() => {
    const disableItem = datasourceConfig?.filter(dsConfigItem => !dsConfigItem?.enable)
    const isSelectAll = disableItem?.length === 0
    const isCheckPart = disableItem?.length > 0 && disableItem?.length < datasourceConfig?.length
    setIsCheckPart(isCheckPart)
    setIsCheckAll(isSelectAll)
  }, [datasourceConfig])

  const onDsConfigItemChange = (enable: boolean, index: number) => {
    const newDatasourceConfig = (datasourceConfig as any)?.setIn([index, 'enable'], enable)
    setSearchStatusInUrl(newDatasourceConfig)
    onDatasourceConfigChange(newDatasourceConfig)
  }

  const selectAll = () => {
    const isSelect = !isCheckAll
    const newDatasourceConfig = datasourceConfig?.map(configItem => {
      return configItem.setIn(['enable'], isSelect)?.asMutable({ deep: true })
    })
    setSearchStatusInUrl(newDatasourceConfig)
    onDatasourceConfigChange(newDatasourceConfig)
  }

  const isDataSourceExist = (dataSourceId: string, isOutputDs: boolean = false) => {
    let isDataSourceInProps
    if (isOutputDs) {
      const appConfig = getAppStore().getState().appConfig
      const widgetsJson = appConfig?.widgets?.[id]
      const outputDs = widgetsJson?.outputDataSources || []
      isDataSourceInProps = outputDs?.filter(dsId => dataSourceId === dsId).length > 0
    } else {
      isDataSourceInProps = useDataSources?.filter(useDs => dataSourceId === useDs.dataSourceId).length > 0
    }
    return isDataSourceInProps && dataSourceId
  }

  const renderFieldListElement = () => {
    return datasourceConfig?.map((configDsItem, index) => {
      const isDsError = dsStatus[configDsItem.configId] === DataSourceStatus.LoadError || dsStatus[configDsItem.configId] === DataSourceStatus.CreateError
      const isGeocodeService = configDsItem.searchServiceType === SearchServiceType.GeocodeService
      const dsId = !isGeocodeService ? configDsItem.useDataSource.dataSourceId : configDsItem.outputDataSourceId
      const isDataSourceExists = isDataSourceExist(dsId, isGeocodeService)

      const disabled = datasourceConfig?.filter(dsConfigItem => dsConfigItem?.enable)?.length === 1 && configDsItem?.enable && isDsError
      return <DropdownItem key={`${configDsItem?.label}${index}`} title={configDsItem?.label} disabled={disabled} onClick={() => { onDsConfigItemChange(!configDsItem?.enable, index) }} >
        <div className='d-flex w-100 h-100 align-items-center'>
          <div className='flex-grow-1 d-flex align-items-center'>
            <Checkbox checked={configDsItem?.enable} disabled={disabled} className='mr-2'/>
            <div className='flex-grow-1'>{configDsItem?.label}</div>
          </div>
          {(isDsError || !isDataSourceExists) && <Alert
            buttonType='tertiary'
            form='tooltip'
            size='small'
            type='error'
            text={nls('dataSourceCreateError')}
          />}
        </div>
      </DropdownItem>
    })
  }

  return (
    <div className={`${className || ''} ds-setting-${config.arrangementStyle}`} css={STYLE} role='group' aria-label={nls('searchIn', { value: '' })}>
      <Dropdown className='w-100 h-100' toggle={toggleSearchSetting} isOpen={isOpen}>
        <DropdownButton className='setting-dropdown-button' arrow={false} icon title={nls('searchIn', { value: '' })}>
          {!isOpen && <DownOutlined size={16} className='mr-1 d-inline-block' autoFlip/>}
          {isOpen && <UpOutlined size={16} className='mr-1 d-inline-block' autoFlip/>}
        </DropdownButton>
        <DropdownMenu trapFocus={false} autoFocus={false} style={{ maxHeight: 'auto' }}>
          <div ref={dropdownMenuRef}>
            <DropdownItem onClick={selectAll} title={nls('all')}>
              <Checkbox checked={isCheckAll || isCheckPart} indeterminate={isCheckPart} className='mr-2'/>
              {nls('all')}
            </DropdownItem>
            <DropdownItem divider={true} />
            {
             renderFieldListElement()
            }
          </div>
        </DropdownMenu>
      </Dropdown>
    </div>
  )
}

export default SearchSetting
