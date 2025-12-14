import buildTime from '~build/time'
import posthog from 'posthog-js'

import { abbreviatedSha } from '~build/git'
import { version } from '~build/package'

export function initPosthog() {
  posthog.init('phc_Cm3b0nTADveo8e0cvpndWC70jwIUqWpG4tvWxL5uK4K', {
    api_host: 'https://p.luoling.moe',
    defaults: '2025-05-24',
    person_profiles: 'identified_only', // or 'always' to create profiles for anonymous users as well
  })

  posthog.register({
    app_version: version ?? 'dev',
    app_commit: abbreviatedSha,
    app_build_time: buildTime,
  })
}
