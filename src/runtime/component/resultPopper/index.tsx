/** @jsx jsx */
import { Popper, type TargetType } from 'jimu-ui'
import { React, jsx, classNames, ReactRedux, type IMState, WidgetState, hooks } from 'jimu-core'
import { getStyle } from '../../style/popper-style'
import { useTheme } from 'jimu-theme'
import { DEFAULT_POPPER_OFFSET } from '../../../config'
const { useEffect, useRef } = React

interface Props {
  id: string
  reference: TargetType
  isOpen: boolean
  isFocusWidtSearchInput?: boolean
  searchInputRef?: any
  children?: React.ReactNode
  autoFocus?: boolean
  className?: string
  offset?: number[]
  toggle?: (e) => void
  version?: number
}

const ResultPopper = (props: Props) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const focusTimeoutRef = useRef<any>(null)
  const { children, isOpen, reference, searchInputRef, autoFocus, className, isFocusWidtSearchInput, id, offset, version, toggle } = props
  const theme = useTheme()

  const stateInControllerWidget = ReactRedux.useSelector((state: IMState) => {
    const widgetsRuntimeInfo = state?.widgetsRuntimeInfo
    return widgetsRuntimeInfo?.[id]?.state
  })

  useEffect(() => {
    if (searchInputRef?.current) {
      isFocusWidtSearchInput && searchInputRef.current?.addEventListener('keydown', handleSearchInputKeyDown, true)
    }

    return () => {
      isFocusWidtSearchInput && searchInputRef.current?.removeEventListener('keydown', handleSearchInputKeyDown, true)
    }
    // eslint-disable-next-line
  }, [])

  const handleSearchInputKeyDown = hooks.useEventCallback((e) => {
    if (!isOpen) {
      return false
    }
    const items = getMenuItems() || []
    const itemLength = items?.length - 1
    if (e.key === 'ArrowUp') {
      focusTimeoutRef.current = setTimeout(() => {
        items[itemLength].focus()
      })
    } else if (e.key === 'ArrowDown') {
      focusTimeoutRef.current = setTimeout(() => {
        items[0].focus()
      })
    }
  })

  const handleKeyDown = hooks.useEventCallback((e) => {
    if (!isOpen) {
      return
    }
    const isTargetMenuItem = e.target.getAttribute('role') === 'button'
    if (!['Tab', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      return
    }

    if (((e.which >= 48) && (e.which <= 90)) || e.key === 'Tab') {
      e.preventDefault()
    }

    if (isOpen && isTargetMenuItem) {
      clearTimeout(focusTimeoutRef.current)
      if (e.key === 'Escape') {
        handleEscEvent(e)
      } else if (
        ['ArrowUp', 'ArrowDown'].includes(e.key) || (['n', 'p'].includes(e.key) && e.ctrlKey)
      ) {
        const $menuitems = getMenuItems()
        let index = $menuitems.indexOf(e.target)
        let isArrowUp = false
        if (e.key === 'ArrowUp' || (e.key === 'p' && e.ctrlKey)) {
          index = index !== 0 ? index - 1 : $menuitems.length - 1
          isArrowUp = true
        } else if (e.key === 'ArrowDown' || (e.key === 'n' && e.ctrlKey)) {
          isArrowUp = false
          index = index === $menuitems.length - 1 ? 0 : index + 1
        }

        const isArrowUpToInput = (index === 0 && !isArrowUp)
        const isArrowDownToInput = (index === $menuitems.length - 1 && isArrowUp)
        if (isFocusWidtSearchInput && (isArrowUpToInput || isArrowDownToInput)) {
          focusTimeoutRef.current = setTimeout(() => {
            searchInputRef.current?.focus()
          })
        } else {
          focusTimeoutRef.current = setTimeout(() => {
            Array.prototype.slice.call(containerRef.current.querySelectorAll('.popper-box'))[0].focus()
            $menuitems[index].focus()
          })
        }
      } else if (e.key === 'End') {
        const $menuitems = getMenuItems()
        focusTimeoutRef.current = setTimeout(() => {
          $menuitems[$menuitems.length - 1].focus()
        })
      } else if (e.key === 'Home') {
        const $menuitems = getMenuItems()
        focusTimeoutRef.current = setTimeout(() => {
          $menuitems[0].focus()
        })
      } else if ((e.which >= 48) && (e.which <= 90)) {
        const $menuitems = getMenuItems()
        const charPressed = String.fromCharCode(e.which).toLowerCase()
        for (let i = 0; i < $menuitems.length; i += 1) {
          const firstLetter = $menuitems[i].textContent && $menuitems[i].textContent[0].toLowerCase()
          if (firstLetter === charPressed) {
            focusTimeoutRef.current = setTimeout(() => {
              $menuitems[i].focus()
            })
            break
          }
        }
      }
    }
  })

  const handleEscEvent = (e) => {
    e.preventDefault()
    togglePopper(e)
    searchInputRef?.current?.focus()
  }

  const getMenuItems = () => {
    return containerRef ? Array.prototype.slice.call(containerRef.current.querySelectorAll('[role="button"]')).filter(item => !item.disabled) : []
  }

  const togglePopper = (e) => {
    toggle(e)
  }

  return (
    <div>
      <Popper
        autoFocus={autoFocus}
        placement='bottom-start'
        open={isOpen}
        toggle={togglePopper}
        css={getStyle(theme, reference)}
        reference={reference}
        version={version}
        className={classNames('result-list-popper', className, { 'hide-popper': stateInControllerWidget === WidgetState.Closed })}
        offset={offset || DEFAULT_POPPER_OFFSET}
        popperNodeRef={containerRef}
      >
        <div onKeyDown={handleKeyDown} >
          {children}
        </div>
      </Popper>
    </div>
  )
}

export default ResultPopper
