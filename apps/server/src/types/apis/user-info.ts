export interface UserInfo {
  id: string
  firstName: string
  lastName: string
  username: string
  photoUrl?: string
}

export interface UserInfoResponse extends UserInfo {}
