import "dotenv/config";
import express from "express";
import { db } from "./db.js";
import { todos } from "./schema.js";
import { eq } from "drizzle-orm";

const app = express();
app.use(express.json());

app.get("/todos", async (req, res) => {
  const list = await db.select().from(todos);
  res.json(list);
});

app.post("/todos", async (req, res) => {
  const { title } = req.body ?? {};
  if (!title) return res.status(400).json({ error: "title required" });

  const [row] = await db.insert(todos).values({ title }).returning();
  res.status(201).json(row);
});

app.post("/todos/:id/toggle", async (req, res) => {
  const id = Number(req.params.id);
  const [item] = await db.select().from(todos).where(eq(todos.id, id));
  if (!item) return res.status(404).json({ error: "not found" });

  const [updated] = await db
    .update(todos)
    .set({ completed: !item.completed })
    .where(eq(todos.id, id))
    .returning();
  res.json(updated);
});

app.listen(3000, () => console.log("API ready → http://localhost:3000"));
