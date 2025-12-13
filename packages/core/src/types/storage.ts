export type MediaKind = 'photo' | 'sticker'

export interface MediaBinaryDescriptor {
  kind: MediaKind
  uuid: string
}

export interface MediaBinaryLocation {
  kind: MediaKind
  /**
   * Provider-specific opaque key or path.
   *
   * This value is persisted in the database (e.g. photos.image_path,
   * stickers.sticker_path) and must be treated as an opaque identifier
   * by callers.
   */
  path: string
}

export interface MediaBinaryProvider {
  /**
   * Persist media bytes and return a stable location descriptor.
   *
   * Implementations are free to choose their own layout scheme (e.g.
   * MinIO object key, OPFS file path) as long as the returned path is
   * sufficient to retrieve the same bytes via load().
   */
  save: (
    descriptor: MediaBinaryDescriptor,
    bytes: Uint8Array,
    mimeType?: string,
  ) => Promise<MediaBinaryLocation>

  /**
   * Load media bytes from a previously returned location.
   *
   * Implementations should return null when the underlying object no
   * longer exists instead of throwing where possible.
   */
  load: (location: MediaBinaryLocation) => Promise<Uint8Array | null>
}
