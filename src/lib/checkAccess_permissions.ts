export enum DgPermissions {
  _no = 0,
  postPartnerships = 1 << 0,
  viewForeignStats = 1 << 1,
  viewDepartmentStats = 1 << 2,
  managePartnerships = 1 << 3,
  manageBlacklist = 1 << 4,
  admin = -1,
}
