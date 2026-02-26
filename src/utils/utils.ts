import { JimuFieldType, type FieldSchema } from 'jimu-core'
import { DefaultAddress } from '../constants'
import { type AddressFields } from 'jimu-ui/advanced/setting-components'
interface AddressFieldSchameResult {
  addressFieldsSchema: FieldSchema[]
  defaultAddressFieldName: string
}
export const getNameOfDefaultAddressField = (fields: FieldSchema[], nameIndex = 0): string => {
  let name = DefaultAddress
  fields?.forEach(field => {
    name = nameIndex ? `${name}${nameIndex}` : name
    if (field.jimuName === name) {
      nameIndex += 1
      name = getNameOfDefaultAddressField(fields, nameIndex)
    }
  })
  return name
}

export const getAddressFieldsSchemaAndDefaultFieldName = (addressFields: AddressFields[] = []): AddressFieldSchameResult => {
  const addressFieldSchema = addressFields?.map(field => {
    return {
      jimuName: field?.alias,
      alias: field?.alias,
      type: JimuFieldType.String,
      name: field?.alias
    }
  })
  const defaultAddressFieldName = getNameOfDefaultAddressField(addressFieldSchema, 0)
  const DefaultAddressSchema = {
    jimuName: defaultAddressFieldName,
    alias: defaultAddressFieldName,
    type: JimuFieldType.String,
    name: defaultAddressFieldName
  }
  addressFieldSchema.unshift(DefaultAddressSchema)
  return {
    addressFieldsSchema: addressFieldSchema,
    defaultAddressFieldName: defaultAddressFieldName
  }
}
