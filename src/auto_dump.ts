import {
  CommonDatabaseDir,
  DB_DelegationStats, DB_InvitesCache, DB_Misc, DB_PartnersData, DB_ServersBlacklist, DB_StaffCache,
  DB_ServersData, DelegationStats_DBFile, InvitesCache_DBFile, Misc_DBFile, StaffCache_DBFile,
  PartnersData_DBFile, ServersData_DBFile
} from "#corelib";

export type AutoDumpAction = (dump: Blob) => any;

const Databases = [
  DB_DelegationStats,
  DB_ServersData,
  DB_PartnersData,
  DB_ServersBlacklist,
  DB_Misc,
  DB_InvitesCache,
  DB_StaffCache,
];
const Files = [
  DelegationStats_DBFile,
  ServersData_DBFile,
  PartnersData_DBFile,
  ServersData_DBFile,
  Misc_DBFile,
  InvitesCache_DBFile,
  StaffCache_DBFile,
];

let ZipFactory: typeof import("jszip");
let AutoDumpAction: AutoDumpAction | undefined;
let AutoDumpInterval = 60 * 60 * 1000; //1 hour
let Job: NodeJS.Timeout;

async function createDump(): Promise<Blob> {
  ZipFactory ??= (await import("jszip")).default;
  const zip = new ZipFactory();
  let dest = zip;

  for (const dir of CommonDatabaseDir.split("/")) {
    dest = dest.folder(dir)!;
    if (dest == null) throw new Error("Failed to create directory in AutoDump Zip file");
  }

  Databases.map((db, index) => {
    const filename = Files[index];
    const documents = db.getAllData();
    const serialized = documents.map(D => JSON.stringify(D)).join("\n");
    dest.file(filename, serialized);
  })
  return zip.generateAsync({ type: "blob" });
}

function runJob() {
  if (Job) clearInterval(Job);
  ;(async () => AutoDumpAction?.(await createDump()))();
  Job = setInterval(async () => AutoDumpAction?.(await createDump()), AutoDumpInterval);
}

export function setAutoDumpAction(fn: AutoDumpAction) {
  AutoDumpAction = fn;
  runJob();
}
export function setAutoDumpInterval(ms: number) {
  AutoDumpInterval = ms;
  runJob();
}
