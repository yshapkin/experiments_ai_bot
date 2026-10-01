import { TableClient, type TableEntity } from "@azure/data-tables";
import { DefaultAzureCredential, ManagedIdentityCredential } from "@azure/identity";

export const USER_TABLE = "users";
export interface UserRow {
  partitionKey: "user";
  rowKey: string;
  telegramUserId: string;
  createdAt: string;
  isActive: boolean;
  isAdmin: boolean;
}
export interface UserRepository {
  register(id: number): Promise<UserRow | null>;
  find(id: number): Promise<UserRow | null>;
}

export function validTelegramId(id: unknown): id is number {
  return typeof id === "number" && Number.isSafeInteger(id) && id > 0;
}

function normalize(row: TableEntity<Record<string, unknown>>, id: number): UserRow | null {
  if (
    row.partitionKey !== "user" ||
    row.rowKey !== String(id) ||
    row.telegramUserId !== row.rowKey ||
    typeof row.createdAt !== "string" ||
    !Number.isFinite(Date.parse(row.createdAt)) ||
    typeof row.isActive !== "boolean" ||
    typeof row.isAdmin !== "boolean"
  ) return null;
  return row as unknown as UserRow;
}

export function createUserRepository(client: Pick<TableClient, "createEntity" | "getEntity">): UserRepository {
  return {
    async find(id) {
      if (!validTelegramId(id)) return null;
      try {
        return normalize(await client.getEntity("user", String(id)), id);
      } catch (error) {
        if (isStatus(error, 404)) return null;
        throw error;
      }
    },
    async register(id) {
      if (!validTelegramId(id)) return null;
      const row: UserRow = {
        partitionKey: "user", rowKey: String(id), telegramUserId: String(id),
        createdAt: new Date().toISOString(), isActive: false, isAdmin: false,
      };
      try {
        await client.createEntity(row);
        return row;
      } catch (error) {
        if (!isStatus(error, 409)) throw error;
        return this.find(id);
      }
    },
  };
}

function isStatus(error: unknown, status: number): boolean {
  return typeof error === "object" && error !== null &&
    "statusCode" in error && error.statusCode === status;
}

export function connectUserRepository(endpoint: string, clientId?: string): UserRepository {
  const credential = clientId
    ? new ManagedIdentityCredential(clientId)
    : new DefaultAzureCredential();
  return createUserRepository(new TableClient(endpoint, USER_TABLE, credential));
}
