import { boolean, pgSchema, serial, text } from "drizzle-orm/pg-core";

const todosSchema = pgSchema("todos");

export const todos = todosSchema.table("todos", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  completed: boolean("completed").default(false),
});
