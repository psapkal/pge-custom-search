/** @jsx jsx */
import { jsx, type DataSourceJson, css, type ImmutableArray } from 'jimu-core'
import { type AllWidgetSettingProps, getAppConfigAction } from 'jimu-for-builder'
import { type SearchDataConfig, SearchDataSetting, SearchDataType } from 'jimu-ui/advanced/setting-components'
import { type IMConfig, SearchServiceType } from '../config'
import SearchResultSetting from './component/search-setting-option'
import ArrangementStyleSetting from './component/arrangement-style'

interface ExtraProps {
  id: string
}

type SettingProps = AllWidgetSettingProps<IMConfig> & ExtraProps

const Setting = (props: SettingProps) => {
  const { config, id, portalUrl, onSettingChange, useDataSources } = props

  const SYLE = css`
    .suggestion-setting-con  {
      padding-bottom: 0;
    }
  `

  const onDataSettingChange = (datasourceConfig: ImmutableArray<SearchDataConfig>, dsInWidgetJson) => {
    if (!datasourceConfig) return false
    const appConfigAction = getAppConfigAction()
    const newConfig = config?.setIn(['datasourceConfig'], datasourceConfig)
    let newWidgetJson = { id, config: newConfig }
    if (dsInWidgetJson?.isWidgetJsonDsChanged && dsInWidgetJson?.dsInWidgetJson) {
      newWidgetJson = {
        ...newWidgetJson,
        ...dsInWidgetJson?.dsInWidgetJson
      }
    }
    appConfigAction.editWidget(newWidgetJson).exec()
  }

  const createOutputDs = (outputDsJsonList: DataSourceJson[], datasourceConfig: ImmutableArray<SearchDataConfig>, dsInWidgetJson) => {
    if (!datasourceConfig) return false
    const newConfig = config?.setIn(['datasourceConfig'], datasourceConfig)
    let newWidgetJson = {
      id,
      config: newConfig,
      useUtilities: getUseUtilities(newConfig)
    }
    if (dsInWidgetJson?.isWidgetJsonDsChanged && dsInWidgetJson?.dsInWidgetJson) {
      newWidgetJson = {
        ...newWidgetJson,
        ...dsInWidgetJson?.dsInWidgetJson
      }
    }
    const appConfigAction = getAppConfigAction()
    appConfigAction.editWidget(newWidgetJson, outputDsJsonList).exec()
  }

  const getUseUtilities = (config: IMConfig) => {
    const useUtilities = []
    config?.datasourceConfig?.forEach(configItem => {
      if (configItem?.searchServiceType === SearchServiceType.GeocodeService) {
        useUtilities.push(configItem?.useUtility)
      }
    })
    return useUtilities
  }

  const handleEnableFilteringChange = (value: boolean) => {
    onSettingChange({ id: id, config: config.set('enableFiltering', value) })
  }

  return (
    <div className='widget-setting-search jimu-widget-search' css={SYLE}>
      <SearchDataSetting
        id={id}
        portalUrl={portalUrl}
        useDataSources={useDataSources}
        createOutputDs={true}
        onSettingChange={onDataSettingChange}
        onOutputDsSettingChange={createOutputDs}
        datasourceConfig={config?.datasourceConfig}
        searchDataSettingType={SearchDataType.Both}
        enableFiltering={config?.enableFiltering}
        onEnableFilteringChange={handleEnableFilteringChange}
      />
      <SearchResultSetting
        id={id}
        config={config}
        onSettingChange={onSettingChange}
        useDataSources={useDataSources}
      />
      <ArrangementStyleSetting
        id={id}
        config={config}
        onSettingChange={onSettingChange}
      />
    </div>
  )
}

export default Setting
