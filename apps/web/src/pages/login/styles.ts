// @unocss-include
export const LOGIN_TRANSITION_ENTER_ACTIVE_CLASS = 'transition duration-300 ease-out absolute inset-0'
export const LOGIN_TRANSITION_ENTER_FROM_CLASS = 'opacity-0 translate-x-4'
export const LOGIN_TRANSITION_ENTER_TO_CLASS = 'opacity-100 translate-x-0 scale-100'
export const LOGIN_TRANSITION_LEAVE_ACTIVE_CLASS = 'transition duration-200 ease-in absolute inset-0'
export const LOGIN_TRANSITION_LEAVE_FROM_CLASS = 'opacity-100 translate-x-0 scale-100'
export const LOGIN_TRANSITION_LEAVE_TO_CLASS = 'opacity-0 -translate-x-4'

const LOGIN_INPUT_CLASS = 'h-11 w-full rounded-lg border-input bg-background text-base transition-colors hover:border-foreground/30 focus-visible:border-ring focus-visible:ring-0 focus-visible:ring-offset-0'
const LOGIN_PRIMARY_BUTTON_CLASS = 'h-11 w-full rounded-lg text-sm font-medium transition-transform active:scale-[0.99]'
const LOGIN_SUCCESS_BADGE_CLASS = 'flex animate-in items-center justify-center rounded-full bg-primary text-primary-foreground duration-500 zoom-in'

export const LOGIN_DESKTOP_INPUT_CLASS = `${LOGIN_INPUT_CLASS} pl-10`
export const LOGIN_DESKTOP_PRIMARY_BUTTON_CLASS = LOGIN_PRIMARY_BUTTON_CLASS
export const LOGIN_DESKTOP_SUCCESS_BADGE_CLASS = `${LOGIN_SUCCESS_BADGE_CLASS} mb-6 h-14 w-14`

export const LOGIN_MOBILE_INPUT_CLASS = `${LOGIN_INPUT_CLASS} h-12 pl-12`
export const LOGIN_MOBILE_PRIMARY_BUTTON_CLASS = `${LOGIN_PRIMARY_BUTTON_CLASS} h-12`
export const LOGIN_MOBILE_SUCCESS_BADGE_CLASS = `${LOGIN_SUCCESS_BADGE_CLASS} h-14 w-14`
export const LOGIN_MOBILE_SUCCESS_BUTTON_CLASS = `${LOGIN_PRIMARY_BUTTON_CLASS} h-12`

export const LOGIN_TITLE_CLASS = 'text-foreground font-semibold tracking-tight'
