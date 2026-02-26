import { type IMThemeVariables, css, polished } from 'jimu-core'
export const getStyle = (theme: IMThemeVariables, reference) => {
  return css`
    & {
      width: ${polished.rem(reference?.current?.clientWidth)};
      padding-top: 0;
      padding-bottom: 0;
      /* visibility: unset !important; */
    }
    &.hide-popper {
      border: none;
      outline: none;
      box-shadow: none;
      width: 0;
    }
    button {
      width: 100%;
      border: none;
      text-align: left;
      min-height: ${polished.rem(32)};
      border-radius: 0;
    }
    .result-list-content {
      position: relative;
      overflow: auto;
    }
    &.suggestion-list-con, .result-list-content {
      max-height: ${polished.rem(300)};
    }
    &.suggestion-list-con {
      overflow: auto;
    }
    &.result-list-con button {
      text-overflow: ellipsis;
      white-space: pre-wrap;
      &:focus-visible {
        background: var(--ref-palette-neutral-200);
      }
    }
    &.result-list-con :disabled, &.result-list-con button:disabled:hover {
      color: ${theme?.sys.color?.secondary?.dark};
      background-color: ${theme?.ref.palette?.neutral?.[300]};
    }
    &.result-list-con button:hover {
      color: ${theme?.ref.palette?.black};
      background-color: ${theme?.ref.palette?.neutral?.[200]};
    }
    &.result-list-con button:focus-visible {
      color: ${theme?.ref.palette?.black};
      background-color: ${theme?.ref.palette?.neutral?.[200]};
    }
    &.result-list-con .dropdown-divider {
      margin-left: 0;
      margin-right: 0;
    }
    &.result-list-con button.active {
      background: ${theme?.sys.color?.primary.main};
      color: ${theme?.ref.palette?.white};
    }
    .show-result-button:active, &.result-list-con .show-result-button:hover {
      background-color: ${theme?.ref.palette?.white};
    }
    &.result-list-con .show-result-button:focus-visible {
      background-color: ${theme?.ref.palette?.white};
    }
    .dropdown-menu--inner {
      max-height: none;
    }
    .jimu-dropdown-item {
      min-height: ${polished.rem(32)};
    }
    .clear-recent-search-con {
      color: var(--sys-color-primary-main) !important;
      height: ${polished.rem(40)};
      margin-top: ${polished.rem(-4)};
    }
    .dropdown-divider {
      min-height: 0;
    }
    .item-p-l {
      padding-left: ${polished.rem(42)} !important;
    }
    .source-label-con {
      color: var(--ref-palette-black) !important;
      font-weight: bold !important;
    }
    .show-result-button-style2 {
      & {
        padding: 0;
        height: ${polished.rem(11)};
        min-height: ${polished.rem(11)};
        justify-content: center;
        align-items: center;
      }
      svg {
        margin-right: 0;
      }
    }
    &.result-list-con-compact-close {
      & {
        width: ${polished.rem(32)};
        border-top: 0;
        justify-content: center;
      }
      .show-result-button {
        & {
          border-radius: 0 0 0.25rem 0.25rem;
          padding: 0;
          height: ${polished.rem(8)};
          min-height: ${polished.rem(8)};
          justify-content: center;
          align-items: center;
        }
        svg {
          margin-right: 0;
          height: ${polished.rem(8)};
        }
      }
    }
    &.result-list-con-compact-open {
      .show-result-button-style2-con {
        position: -webkit-sticky;
        position: sticky;
        bottom: 0;
        left: 0;
        right: 0;
        background: var(--ref-palette-white);
      }
    }
  `
}

export const dropdownStyle = () => {
  return css`
    .search-dropdown-button {
      position: absolute;
      top: 0;
      bottom: 0;
      height: auto;
      z-index: -1;
    }
    & {
      position: initial;
    }
  `
}
