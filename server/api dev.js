// Updated api.js with improved static file serving
import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import fs from "fs";
import cors from "cors";
import Papa from "papaparse";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

// Configure CORS to allow requests from your frontend
app.use(
  cors({
    origin: "http://localhost:5173", // Replace with your frontend URL if different
    credentials: true,
  })
);

mongoose.connect(
  "mongodb+srv://andngdvlpr:kXdP5wTJZU0meWeT@cluster0.kujaymj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
);

app.use(express.json({ limit: "50mb" })); // Increased limit for larger code files

// Setup static file serving
app.use(express.static(path.join(__dirname, "dist"))); // Serve dist/ at root level
app.use(express.static(path.join(__dirname))); // Serve root directory
app.use(express.static(path.join(__dirname, "app"))); // Serve app/ directory
app.use("/img", express.static(path.join(__dirname, "img"))); // Serve img/ directory
app.use("/aud", express.static(path.join(__dirname, "aud"))); // Serve aud/ directory
app.use("/vid", express.static(path.join(__dirname, "vid")));

// Serve the experiment page
app.get("/experiment", (req, res) => {
  res.sendFile(path.join(__dirname, "experiment.html"));
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const metadataPath = path.resolve(__dirname, "metadata");

// Serve the metadata directory at `/metadata` URL path
app.use("/metadata", express.static(metadataPath));

app.get("/api/plugins-list", (req, res) => {
  const metadataDir = path.join(__dirname, "metadata");
  fs.readdir(metadataDir, (err, files) => {
    if (err) return res.status(500).json({ error: "No metadata dir" });
    // Solo archivos .json
    const plugins = files
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""));
    res.json({ plugins });
  });
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    let folder = "others";

    if (/\.(png|jpg|jpeg|gif)$/i.test(ext)) {
      folder = "img";
    } else if (/\.(mp3|wav|ogg|m4a)$/i.test(ext)) {
      folder = "aud";
    } else if (/\.(mp4|webm|mov|avi)$/i.test(ext)) {
      folder = "vid";
    }

    const fullPath = path.join(__dirname, folder);
    fs.mkdirSync(fullPath, { recursive: true }); // Crea la carpeta si no existe
    cb(null, fullPath);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage });

app.post("/api/upload-file", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No se subió ningún archivo" });
  }

  const ext = path.extname(req.file.originalname).toLowerCase();
  let folder = "others";
  if (/\.(png|jpg|jpeg|gif)$/i.test(ext)) {
    folder = "img";
  } else if (/\.(mp3|wav|ogg|m4a)$/i.test(ext)) {
    folder = "aud";
  } else if (/\.(mp4|webm|mov|avi)$/i.test(ext)) {
    folder = "vid";
  }

  res.json({ filePath: `${folder}/${req.file.filename}` });
});

app.post("/api/upload-files-folder", upload.array("files"), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "No se subieron archivos" });
  }

  const filePaths = req.files.map((file) => {
    const ext = path.extname(file.originalname).toLowerCase();
    let folder = "others";

    if (/\.(png|jpg|jpeg|gif)$/i.test(ext)) {
      folder = "img";
    } else if (/\.(mp3|wav|ogg|m4a)$/i.test(ext)) {
      folder = "aud";
    } else if (/\.(mp4|webm|mov|avi)$/i.test(ext)) {
      folder = "vid";
    }

    return `${folder}/${file.filename}`;
  });

  res.json({ filePaths });
});

app.get("/api/list-files", (req, res) => {
  const folders = ["img", "aud", "vid"];
  let files = [];

  folders.forEach((folder) => {
    const dir = path.join(__dirname, folder);
    if (fs.existsSync(dir)) {
      const folderFiles = fs.readdirSync(dir).map((f) => `${folder}/${f}`);
      files = files.concat(folderFiles);
    }
  });

  res.json({ files });
});

app.delete("/api/delete-file/:filename", (req, res) => {
  const filename = req.params.filename;

  const folders = ["img", "aud", "vid"];
  let fileDeleted = false;

  for (const folder of folders) {
    const filePath = path.join(__dirname, folder, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      fileDeleted = true;
      break;
    }
  }

  if (!fileDeleted) {
    return res
      .status(404)
      .json({ success: false, error: "Archivo no encontrado" });
  }

  res.json({ success: true });
});

app.get("/api/load-trials", (req, res) => {
  const trialsPath = path.join(__dirname, "app", "trials.json");
  if (!fs.existsSync(trialsPath)) {
    return res.json({ trials: null });
  }
  const trials = fs.readFileSync(trialsPath, "utf8");
  res.json({ trials: JSON.parse(trials) });
});

app.post("/api/save-trials", (req, res) => {
  try {
    const trials = req.body;

    // Make sure the app directory exists
    if (!fs.existsSync(path.join(__dirname, "app"))) {
      fs.mkdirSync(path.join(__dirname, "app"), { recursive: true });
    }

    // Save the configuration to a file
    fs.writeFileSync(
      path.join(__dirname, "app/trials.json"),
      JSON.stringify(trials, null, 2)
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Error saving trials:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete("/api/trials/:id", (req, res) => {
  const trialsPath = path.join(__dirname, "app", "trials.json");

  try {
    if (!fs.existsSync(trialsPath)) {
      return res
        .status(404)
        .json({ success: false, error: "No trials found." });
    }

    const fileContent = fs.readFileSync(trialsPath, "utf8");
    const parsed = JSON.parse(fileContent);

    if (!parsed.trials || !Array.isArray(parsed.trials)) {
      return res.status(400).json({ success: false, error: "Invalid format" });
    }

    const idToDelete = String(req.params.id);
    const updatedTrials = parsed.trials.filter(
      (t) => String(t.id) !== idToDelete
    );

    if (updatedTrials.length === parsed.trials.length) {
      return res
        .status(404)
        .json({ success: false, error: "Trial not found." });
    }

    fs.writeFileSync(
      trialsPath,
      JSON.stringify({ trials: updatedTrials }, null, 2)
    );

    console.log(`Trial ${idToDelete} eliminado correctamente.`);
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting trial:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/load-config", (req, res) => {
  const configPath = path.join(__dirname, "app", "config.json");
  if (!fs.existsSync(configPath)) {
    return res.json({ config: null });
  }
  const config = fs.readFileSync(configPath, "utf8");
  res.json({ config: JSON.parse(config) });
});

// API endpoint to save configuration and generated code
app.post("/api/save-config", (req, res) => {
  try {
    const config = req.body;

    // Make sure the app directory exists
    if (!fs.existsSync(path.join(__dirname, "app"))) {
      fs.mkdirSync(path.join(__dirname, "app"), { recursive: true });
    }

    // Save the configuration to a file
    fs.writeFileSync(
      path.join(__dirname, "app/config.json"),
      JSON.stringify(config, null, 2)
    );

    // Save the generated code to main.js
    if (config.generatedCode) {
      fs.writeFileSync(
        path.join(__dirname, "app/main.js"),
        config.generatedCode
      );
      console.log("Generated code saved to app/main.js");
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error saving configuration:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// API endpoint to build the experiment
app.post("/api/build-experiment", (req, res) => {
  // Make sure the dist directory exists
  if (!fs.existsSync(path.join(__dirname, "dist"))) {
    fs.mkdirSync(path.join(__dirname, "dist"), { recursive: true });
  }

  // Rebuild using webpack
  exec("npx webpack --config webpack.config.mjs", (error, stdout, stderr) => {
    if (error) {
      console.error(`Error building experiment: ${error.message}`);
      return res.status(500).json({ success: false, error: error.message });
    }

    if (stderr && !stderr.includes("WARNING")) {
      console.error(`Stderr: ${stderr}`);
      return res.status(500).json({ success: false, error: stderr });
    }

    console.log(`Build output: ${stdout}`);
    res.json({
      success: true,
      message: "Experiment built successfully",
      experimentUrl: "http://localhost:3000/experiment",
    });
  });
});

// API endpoint to run the experiment
app.post("/api/run-experiment", (req, res) => {
  try {
    // Make sure the dist directory exists
    if (!fs.existsSync(path.join(__dirname, "dist"))) {
      fs.mkdirSync(path.join(__dirname, "dist"), { recursive: true });
    }

    // First, make sure the experiment is built
    exec(
      "npx webpack --config webpack.config.mjs",
      (buildError, buildStdout, buildStderr) => {
        if (buildError) {
          console.error(`Error building experiment: ${buildError.message}`);
          return res
            .status(500)
            .json({ success: false, error: buildError.message });
        }

        console.log(`Build output: ${buildStdout}`);

        // Create experiment.html file that will load the bundled JS
        const experimentHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="icon" type="image/png+xml" href="/icon/fp black.png" />
  <title>Experiment</title>
  <link href="https://unpkg.com/jspsych@7.3.1/css/jspsych.css" rel="stylesheet" type="text/css">
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f0f0f0;
    }
    #jspsych-target {
      width: 100%;
    }
  </style>
</head>
<body>
  <div id="jspsych-target"></div>
  <script src="/dist/bundle.js"></script>
</body>
</html>
      `;

        fs.writeFileSync(
          path.join(__dirname, "experiment.html"),
          experimentHtml
        );

        res.json({
          success: true,
          message: "Experiment built and ready to run",
          experimentUrl: "http://localhost:3000/experiment",
        });
      }
    );
  } catch (error) {
    console.error(`Error preparing experiment: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Modelo para resultados individuales por participante
const SessionResultSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
  data: { type: Array, default: [] },
});
const SessionResult =
  mongoose.models.SessionResult ||
  mongoose.model("SessionResult", SessionResultSchema);

// Endpoint para agregar una respuesta a la sesión
app.post("/api/append-result", async (req, res) => {
  try {
    let { sessionId, response } = req.body;
    if (!sessionId || !response)
      return res
        .status(400)
        .json({ success: false, error: "sessionId and response required" });

    // Si recibes un string, parsea:
    if (typeof response === "string") response = JSON.parse(response);

    // Busca el documento o créalo si no existe
    const updated = await SessionResult.findOneAndUpdate(
      { sessionId },
      { $push: { data: response } },
      { upsert: true, new: true }
    );

    res.json({ success: true, id: updated._id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint para obtener los resultados de una sesión
app.get("/api/session-results", async (req, res) => {
  try {
    const sessions = await SessionResult.find({}, { data: 0 }).sort({
      createdAt: -1,
    });
    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/download-session/:sessionId", async (req, res) => {
  try {
    const doc = await SessionResult.findOne({
      sessionId: req.params.sessionId,
    });
    if (!doc) return res.status(404).send("Not found");

    // Filtra preload si quieres
    const filteredData = doc.data.filter((row) => row.trial_type !== "preload");

    const allFields = Array.from(
      new Set(filteredData.flatMap((row) => Object.keys(row)))
    );

    const csv = Papa.unparse({
      data: filteredData,
      fields: allFields,
    });

    res.header("Content-Type", "text/csv");
    res.attachment("session_results.csv");
    res.send(csv);
  } catch (err) {
    res.status(500).send("Error at downloading CSV");
  }
});

app.delete("/api/session-results/:sessionId", async (req, res) => {
  try {
    const deleted = await SessionResult.findOneAndDelete({
      sessionId: req.params.sessionId,
    });
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, error: "Session not found" });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Middleware to handle 404 errors
app.use((req, res) => {
  console.log(`404 Not Found: ${req.url}`);
  res.status(404).send("This page doesn't exist.");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`- Experiment URL: http://localhost:${port}/experiment`);
  console.log(`- Static files being served from:`);
  console.log(`  * ${path.join(__dirname, "dist")}`);
  console.log(`  * ${path.join(__dirname)}`);
  console.log(`  * ${path.join(__dirname, "app")}`);
  console.log(`  * ${path.join(__dirname, "img")} (as /img)`);
  console.log(`  * ${path.join(__dirname, "aud")} (as /aud)`);
});
