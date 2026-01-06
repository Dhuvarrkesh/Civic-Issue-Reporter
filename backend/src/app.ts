import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import adminRoutes from "./routes/admin.routes";
import citizenRoutes from "./routes/citizen.routes";
import issueRoutes from "./routes/issue.routes";

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(cookieParser());

// Simple request logger to help diagnose missing routes
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Debug endpoint to list registered routes (useful during troubleshooting)
app.get('/api/v1/debug/routes', (_req, res) => {
  const routes: string[] = [];
  (app as any)._router.stack.forEach((middleware: any) => {
    if (middleware.route) {
      const methods = Object.keys(middleware.route.methods).map(m => m.toUpperCase()).join(', ');
      routes.push(`${methods} ${middleware.route.path}`);
    } else if (middleware.name === 'router' && middleware.handle && middleware.handle.stack) {
      middleware.handle.stack.forEach((handler: any) => {
        if (handler.route) {
          const methods = Object.keys(handler.route.methods).map(m => m.toUpperCase()).join(', ');
          routes.push(`${methods} ${handler.route.path}`);
        }
      });
    }
  });
  res.json({ routes });
});


// routes declaration

app.use("/api/v1", citizenRoutes);
app.use("/api/v1", adminRoutes);
app.use("/api/v1", issueRoutes);
app.use("/api", (req, res) => {
  console.warn(`No matching API route for ${req.method} ${req.originalUrl} - headers: ${JSON.stringify(req.headers)}`);
  res.status(404).json({ message: "API route not found" });
});
import path from "path";

app.get('/', (req, res) => {
  res.send('Civic Issue Reporter Backend is Running');
});

// Serve frontend's index.html for any non-API GET request when running in production
app.get(/^\/(?!api).*/, (req, res) => {
  const indexPath = path.join(__dirname, "..", "public", "index.html");
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.warn(`Could not serve index.html from public: ${err.message}`);
      res.status(404).send('Not Found');
    }
  });
});


export default app;
