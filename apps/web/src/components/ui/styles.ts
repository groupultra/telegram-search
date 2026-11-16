// Shared class recipes for the UI primitives in this directory. Every control
// takes its size, radius, colors and motion from here so they stay identical
// across components. The values follow LobeUI's Base UI components.
// @unocss-include

export type ControlSize = 'sm' | 'md' | 'lg'

export const CONTROL_TRANSITION = 'transition-[color,background-color,border-color,box-shadow,opacity] duration-150 ease-out'

/** Buttons and other text controls: 24 / 32 / 40 px tall. */
export const CONTROL_SIZE_CLASS: Record<ControlSize, string> = {
  sm: 'h-6 gap-1 rounded-sm px-2 text-xs',
  md: 'h-8 gap-1.5 rounded-sm px-3.5 text-[13px]',
  lg: 'h-10 gap-1.5 rounded-md px-4 text-sm',
}

/** Square icon-only controls, same heights as CONTROL_SIZE_CLASS. */
export const ICON_CONTROL_SIZE_CLASS: Record<ControlSize, string> = {
  sm: 'h-6 w-6 rounded-xs',
  md: 'h-8 w-8 rounded-sm',
  lg: 'h-10 w-10 rounded-md',
}

export const ICON_GLYPH_SIZE_CLASS: Record<ControlSize, string> = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
}

/** Inputs, textareas and select triggers. */
export const FIELD_SIZE_CLASS: Record<ControlSize, string> = {
  sm: 'min-h-6 gap-1.5 rounded-sm px-2 text-xs',
  md: 'min-h-8 gap-2 rounded-md px-3 text-sm',
  lg: 'min-h-10 gap-2 rounded-md px-3 text-sm',
}

export type FieldVariant = 'outlined' | 'filled' | 'borderless'

export const FIELD_VARIANT_CLASS: Record<FieldVariant, string> = {
  outlined: 'border border-line bg-container hover:border-fg-4 focus-within:border-primary focus-within:shadow-[0_0_0_2px_var(--fill-secondary)] dark:border-transparent dark:bg-fill-3 dark:hover:bg-fill-2 dark:focus-within:border-line',
  filled: 'border border-transparent bg-fill-3 hover:bg-fill-2 focus-within:bg-fill-2',
  borderless: 'border border-transparent bg-transparent',
}

export const FIELD_BASE_CLASS = `flex w-full items-center text-fg ${CONTROL_TRANSITION} has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60`

/** Floating surfaces: menus, popovers, selects. No border; a hairline ring instead. */
export const POPUP_SURFACE_CLASS = 'z-50 rounded-md bg-elevated text-fg shadow-popup outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-150'

export const MENU_POPUP_CLASS = `${POPUP_SURFACE_CLASS} min-w-[11rem] overflow-hidden p-1`

export const MENU_ITEM_CLASS = 'relative min-h-8 flex cursor-default select-none items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-sm leading-5 outline-none transition-colors data-[highlighted]:bg-fill-3 data-[disabled]:pointer-events-none data-[state=open]:bg-fill-3 data-[disabled]:opacity-50'

export const MENU_LABEL_CLASS = 'eyebrow px-2.5 pb-1.5 pt-2'

export const MENU_SEPARATOR_CLASS = 'mx-1 my-1 h-px bg-line-2'

/** Rows in lists and side navigation: hover and active use the same fills as menus. */
export const LIST_ITEM_CLASS = `flex w-full cursor-pointer select-none items-center gap-3 rounded-md px-3 text-left text-sm text-fg-2 ${CONTROL_TRANSITION} hover:bg-fill-3 hover:text-fg`
export const LIST_ITEM_ACTIVE_CLASS = 'bg-fill-2! text-fg! font-medium'
