export const SAMPLE_NAME = 'userService.ts'

export const SAMPLE_CODE = `import { db } from "./db";

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

const cache: any = {};

/**
 * Looks up users by name.
 * Results are cached so repeated lookups are fast.
 */
export async function findUsers(name: string): Promise<User[]> {
  if (cache[name]) {
    return cache[name];
  }

  // Build the query
  const query = "SELECT * FROM users WHERE name = '" + name + "'";
  const rows = await db.query(query);

  const users: User[] = [];
  for (let i = 0; i < rows.length; i++) {
    users.push({
      id: rows[i].id,
      name: rows[i].name,
      email: rows[i].email,
      role: rows[i].role,
    });
  }

  cache[name] = users;
  return users;
}

export async function deleteInactiveUsers(days: number) {
  const users = await db.query("SELECT * FROM users");
  let deleted = 0;

  for (const user of users) {
    const lastLogin = await db.query(
      "SELECT last_login FROM logins WHERE user_id = " + user.id
    );
    const cutoff = days * 24 * 60 * 60 * 1000;
    const inactive = Date.now() - lastLogin[0].last_login > cutoff;
    if (inactive) {
      await db.query("DELETE FROM users WHERE id = " + user.id);
      deleted++;
    }
  }

  console.log(\`Deleted \${deleted} users\`);
  return deleted;
}

export function formatUser(u: User) {
  return u.name + " <" + u.email + ">" + (u.role == "admin" ? " (admin)" : "");
}
`

export const SAMPLE_DIFF_NAME = 'fix-user-queries.diff'

/** A diff of the sample above and of a new test for it, written by `git diff` and kept as it wrote it. */
export const SAMPLE_DIFF = `diff --git a/userService.ts b/userService.ts
index cdebf44..7ef4a86 100644
--- a/userService.ts
+++ b/userService.ts
@@ -7,20 +7,19 @@ export interface User {
   role: string;
 }
 
-const cache: any = {};
+const cache = new Map<string, User[]>();
 
 /**
  * Looks up users by name.
  * Results are cached so repeated lookups are fast.
  */
 export async function findUsers(name: string): Promise<User[]> {
-  if (cache[name]) {
-    return cache[name];
+  const hit = cache.get(name);
+  if (hit) {
+    return hit;
   }
 
-  // Build the query
-  const query = "SELECT * FROM users WHERE name = '" + name + "'";
-  const rows = await db.query(query);
+  const rows = await db.query("SELECT * FROM users WHERE name = ?", [name]);
 
   const users: User[] = [];
   for (let i = 0; i < rows.length; i++) {
@@ -32,7 +31,7 @@ export async function findUsers(name: string): Promise<User[]> {
     });
   }
 
-  cache[name] = users;
+  cache.set(name, users);
   return users;
 }
 
diff --git a/userService.test.ts b/userService.test.ts
new file mode 100644
index 0000000..3de8044
--- /dev/null
+++ b/userService.test.ts
@@ -0,0 +1,12 @@
+import { describe, expect, it, vi } from "vitest";
+import { findUsers } from "./userService";
+
+vi.mock("./db", () => ({ db: { query: vi.fn(async () => []) } }));
+
+describe("findUsers", () => {
+  it("asks the database with the name as a parameter, not inside the query", async () => {
+    const { db } = await import("./db");
+    await findUsers("o'brien");
+    expect(db.query).toHaveBeenCalledWith("SELECT * FROM users WHERE name = ?", ["o'brien"]);
+  });
+});
`
