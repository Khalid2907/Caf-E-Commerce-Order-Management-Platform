/**
 * COMMON GROUND — Express & Socket.IO Application Entry Point
 */

require("dotenv").config();
const http = require("http");
const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const { Server } = require("socket.io");
const db = require("./db");
const { seedDatabase } = require("./db/seed");
const apiRouter = require("./routes/api");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST", "PATCH", "DELETE"],
  },
});

app.set("io", io);

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "ws:", "wss:"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || true,
    credentials: true,
  })
);

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false }));

// API Routes (auto-initialize DB on first request for serverless environments like Vercel)
app.use("/api", async (req, res, next) => {
  try {
    await ensureInitialized();
    next();
  } catch (err) {
    next(err);
  }
});
app.use("/api", apiRouter);

// Serve static frontend assets from project root
const publicRoot = path.resolve(__dirname, "..");
app.use(
  express.static(publicRoot, {
    extensions: ["html"],
    index: "index.html",
  })
);

// 404 handler for unknown API routes
app.use("/api/*", (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: "ENDPOINT_NOT_FOUND",
      message: `API endpoint ${req.method} ${req.originalUrl} not found.`,
    },
  });
});

// Centralized Error Handling Middleware
app.use((err, req, res, next) => {
  if (process.env.NODE_ENV !== "test") {
    console.error("[Server Error]:", err);
  }
  const status = err.statusCode || 500;
  res.status(status).json({
    success: false,
    error: {
      code: err.code || "INTERNAL_SERVER_ERROR",
      message:
        status === 500
          ? "An unexpected server error occurred."
          : err.message || "Request failed.",
    },
  });
});

// Socket.IO connection handling
io.on("connection", (socket) => {
  socket.on("track:join", (orderReference) => {
    if (orderReference) {
      socket.join(`order:${String(orderReference).replace(/^#/, "")}`);
    }
  });
});

let initPromise = null;
async function ensureInitialized() {
  if (db.isInitialized()) return;
  if (!initPromise) {
    initPromise = seedDatabase().then(() => {
      db.setInitialized(true);
    });
  }
  await initPromise;
}

async function startServer(port = process.env.PORT || 8090) {
  await ensureInitialized();
  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(
        `[Common Ground] Full-Stack Server & Socket.IO listening on http://localhost:${port}`
      );
      resolve(server);
    });
  });
}

if (require.main === module) {
  startServer().catch((err) => {
    console.error("Failed to start Common Ground server:", err);
    process.exit(1);
  });
}

module.exports = {
  app,
  server,
  io,
  ensureInitialized,
  startServer,
};
