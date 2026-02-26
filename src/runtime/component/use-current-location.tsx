/** @jsx jsx */
import { React, jsx, hooks } from 'jimu-core'
import { Button, defaultMessages as jimuiDefaultMessage } from 'jimu-ui'
import defaultMessage from '../translations/default'
import { getCurrentLocation, getCurrentAddress } from '../utils/locator-service'
import { PinOutlined } from 'jimu-icons/outlined/application/pin'
import { WarningOutlined } from 'jimu-icons/outlined/suggested/warning'
import { type GeocodeListItem, type IMServiceList, SearchServiceType, type InitResultServiceListOption } from '../../config'
interface CurrentLocationProps {
  isShowCurrentLocation: boolean
  serviceList: IMServiceList
  locationLoading: boolean
  isGetLocationError: boolean
  onLocationChange: (searchText: string, initResultServiceListOption?: InitResultServiceListOption, isUseLocationError?: boolean) => void
  handleLocationLoadingChange: (loading: boolean) => void
}

const CurrentLocation = (props: CurrentLocationProps) => {
  const nls = hooks.useTranslation(defaultMessage, jimuiDefaultMessage)
  const { serviceList, locationLoading, isGetLocationError, onLocationChange, handleLocationLoadingChange } = props
  const [geocodeServiceItem, setGeocodeServiceItem] = React.useState<GeocodeListItem>(null)

  React.useEffect(() => {
    initGeocodeService()
    // eslint-disable-next-line
  }, [serviceList])

  const confirmUseCurrentLocation = () => {
    if (locationLoading) {
      return false
    }
    handleLocationLoadingChange(true)
    getCurrentLocation(getLocationSuccess, getLocationError)
  }

  const initGeocodeService = () => {
    for (const configId in serviceList) {
      const serviceItem = serviceList[configId]?.asMutable({ deep: true })
      if (serviceItem.searchServiceType === SearchServiceType.GeocodeService) {
        setGeocodeServiceItem(serviceItem)
        break
      }
    }
  }

  const getLocationSuccess = (position) => {
    handleLocationLoadingChange(false)
    const longitude = position.coords.longitude
    const latitude = position.coords.latitude
    const address = `${longitude},${latitude}`
    if (geocodeServiceItem) {
      const geocodeURL = geocodeServiceItem?.geocodeURL
      getCurrentAddress(geocodeURL, position, geocodeServiceItem?.spatialReference).then(res => {
        onLocationChange(res)
      }, err => {
        onLocationChange(address)
      })
    } else {
      onLocationChange(address)
    }
  }

  const getLocationError = (error) => {
    handleLocationLoadingChange(false)
    onLocationChange(null, null, true)
  }

  return (
    <div>
      {!isGetLocationError && <Button role='button' onClick={confirmUseCurrentLocation} title={nls('useCurrentLocation')}>
        <PinOutlined className='mr-2'/>
        {nls('useCurrentLocation')}
      </Button>}
      {isGetLocationError && <Button role='button' title={nls('couldNotRetrieve')}>
        <WarningOutlined className='mr-2'/>
        {nls('couldNotRetrieve')}
      </Button>}
    </div>
  )
}

export default CurrentLocation
