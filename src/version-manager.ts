import { BaseVersionManager, JimuFieldType, loadArcGISJSAPIModules, UtilityManager, type UseUtility } from 'jimu-core'
import { getAddressFieldsSchemaAndDefaultFieldName } from './utils/utils'
import { type IMConfig, SearchResultStyle, SearchServiceType } from './config'
import { OutputDsAddress } from './constants'
export const AddressSchema = {
  jimuName: OutputDsAddress,
  alias: 'ADDRESS',
  type: JimuFieldType.String,
  name: OutputDsAddress
}
const getUrlOfUseUtility = async (useUtility: UseUtility) => {
  return UtilityManager.getInstance().getUrlOfUseUtility(useUtility)
    .then((url) => {
      return Promise.resolve(url)
    })
}
class VersionManager extends BaseVersionManager {
  versions = [
    {
      version: '1.9.0',
      description: 'For geocode service, use arrary of Schema to set displayFields',
      upgrader: (oldConfig: IMConfig) => {
        const newDatasourceConfig = oldConfig?.asMutable({ deep: true })?.datasourceConfig?.map(dsConfig => {
          if (dsConfig?.searchServiceType === SearchServiceType.FeatureService) {
            return dsConfig
          } else {
            if (dsConfig?.displayFields) {
              return dsConfig
            } else {
              dsConfig.displayFields = [AddressSchema]
              dsConfig.addressFields = [AddressSchema]
              dsConfig.defaultAddressFieldName = AddressSchema.jimuName
              return dsConfig
            }
          }
        })
        return oldConfig.setIn(['datasourceConfig'], newDatasourceConfig)
      }
    },
    {
      version: '1.10.0',
      description: 'For locator service, need to save support for suggest in config',
      upgrader: async (oldConfig: IMConfig) => {
        const newDatasourceConfigPromise = oldConfig?.asMutable({ deep: true })?.datasourceConfig?.map(dsConfigItem => {
          if (dsConfigItem?.searchServiceType === SearchServiceType.FeatureService) {
            return Promise.resolve(dsConfigItem)
          } else {
            return getUrlOfUseUtility(dsConfigItem?.useUtility).then(async url => {
              return loadArcGISJSAPIModules(['esri/request']).then(modules => {
                const [esriRequest] = modules
                return esriRequest(url, {
                  query: {
                    f: 'json'
                  },
                  responseType: 'json'
                }).then(res => {
                  const result = res?.data || {}
                  if (result?.capabilities) {
                    const capabilitiesArr = result?.capabilities?.split(',') || []
                    const isSupportSuggest = capabilitiesArr?.includes('Suggest')
                    dsConfigItem.isSupportSuggest = isSupportSuggest
                    return Promise.resolve(dsConfigItem)
                  } else {
                    return Promise.resolve(dsConfigItem)
                  }
                }, err => {
                  return Promise.resolve(dsConfigItem)
                })
              }, err => {
                return Promise.resolve(dsConfigItem)
              })
            })
          }
        })
        const newDatasourceConfig = newDatasourceConfigPromise ? await Promise.all(newDatasourceConfigPromise) : []
        return oldConfig.setIn(['datasourceConfig'], newDatasourceConfig)
      }
    },
    {
      version: '1.12.0',
      description: 'For old search widgets, "enableFiltering" needs to be "true" by default, and the default value of "searchResultStyle" should be "Classic"',
      upgrader: async (oldConfig: IMConfig) => {
        const addCandidateFieldsForOdlWidget = async () => {
          const newDatasourceConfigPromise = oldConfig?.asMutable({ deep: true })?.datasourceConfig?.map(async dsConfigItem => {
            if (dsConfigItem?.searchServiceType === SearchServiceType.FeatureService) {
              return Promise.resolve(dsConfigItem)
            } else {
              return getUrlOfUseUtility(dsConfigItem?.useUtility).then(url => {
                return loadArcGISJSAPIModules(['esri/request']).then(modules => {
                  const [esriRequest] = modules
                  return esriRequest(url, {
                    query: {
                      f: 'json'
                    },
                    responseType: 'json'
                  }).then(res => {
                    const result = res?.data || {}
                    if (result?.capabilities) {
                      const candidateFields = result?.candidateFields || []
                      const { addressFieldsSchema } = getAddressFieldsSchemaAndDefaultFieldName(candidateFields)
                      const preAddressFields = dsConfigItem?.addressFields || []
                      const newAddressFields = preAddressFields.concat(addressFieldsSchema)
                      dsConfigItem.addressFields = newAddressFields
                      return Promise.resolve(dsConfigItem)
                    } else {
                      return Promise.resolve(dsConfigItem)
                    }
                  }, err => {
                    return Promise.resolve(dsConfigItem)
                  })
                })
              })
            }
          })
          const newDatasourceConfig = newDatasourceConfigPromise ? await Promise.all(newDatasourceConfigPromise) : []
          return newDatasourceConfig
        }
        const newDatasourceConfig = await addCandidateFieldsForOdlWidget()
        return oldConfig.setIn(['enableFiltering'], true).setIn(['datasourceConfig'], newDatasourceConfig).setIn(['searchResultStyle'], SearchResultStyle.Classic)
      }
    },
    {
      version: '1.15.0',
      description: 'Add spatialReference for locator service',
      upgrader: async (oldConfig: IMConfig) => {
        let isUpgradeApp = false
        const addSpatialReferenceForLocatorServiceInOdlWidget = async () => {
          const newDatasourceConfigPromise = oldConfig?.asMutable({ deep: true })?.datasourceConfig?.map(async dsConfigItem => {
            if (dsConfigItem?.searchServiceType === SearchServiceType.FeatureService) {
              return Promise.resolve(dsConfigItem)
            } else {
              return getUrlOfUseUtility(dsConfigItem?.useUtility).then(url => {
                return loadArcGISJSAPIModules(['esri/request']).then(modules => {
                  const [esriRequest] = modules
                  return esriRequest(url, {
                    query: {
                      f: 'json'
                    },
                    responseType: 'json'
                  }).then(res => {
                    const result = res?.data || {}
                    if (result?.spatialReference) {
                      isUpgradeApp = true
                      dsConfigItem.spatialReference = result.spatialReference
                      return Promise.resolve(dsConfigItem)
                    } else {
                      return Promise.resolve(dsConfigItem)
                    }
                  }, err => {
                    return Promise.resolve(dsConfigItem)
                  })
                })
              })
            }
          })
          const newDatasourceConfig = newDatasourceConfigPromise ? await Promise.all(newDatasourceConfigPromise) : []
          return newDatasourceConfig
        }
        const newDatasourceConfig = await addSpatialReferenceForLocatorServiceInOdlWidget()
        const newConfig = oldConfig.setIn(['datasourceConfig'], newDatasourceConfig)
        return isUpgradeApp ? newConfig : oldConfig
      }
    }
  ]
}

export const versionManager = new VersionManager()
