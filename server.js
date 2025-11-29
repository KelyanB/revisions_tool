import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import multer from "multer";
import admin from "firebase-admin";
import fs from "fs";

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT 
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : JSON.parse(fs.readFileSync("./serviceAccountKey.json", "utf-8"));


dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccountJson),
  storageBucket: "revisions-cours.appspot.com",
});

const storage = admin.storage();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("Erreur: GEMINI_API_KEY manquante dans le fichier .env");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// Endpoint Gemini
app.post("/api/generate-summary", async (req, res) => {
  try {
    console.log("Requête reçue sur /api/generate-summary");
    const { rawText, courseName, courseDescription, courseDetails } = req.body;

    const baseText =
      rawText ||
      "L'utilisateur n'a pas fourni de contenu de prise de notes, mais souhaite une fiche de révision.";
    const name = courseName || "Sans titre";
    const description =
      courseDescription || "Cours de Licence Professionnelle Banque.";
    const details =
      courseDetails || "Aucune consigne particulière sur l'organisation.";

       const prompt = `
Tu es un professeur de Licence Professionnelle Banque.
Ton rôle est de transformer la prise de notes ci‑dessous en fiche de révision, principalement basée sur ces notes (pas d'ajout massif de connaissances extérieures).

Nom du cours : ${name}
Description du cours :
${description}

Consignes d'organisation données par l'étudiant :
${details}

Texte de prise de notes (source principale) :
"""
${baseText}
"""

Règles :
- Tu peux réorganiser, clarifier et compléter légèrement pour que la fiche soit plus pédagogique.
- Tu peux ajouter de petits résumés, des exemples simples ou des mises en forme si cela aide à comprendre.
- Tu peux représenter les schémas ou tableaux du cours sous forme de listes structurées ou de pseudo-tableaux en texte.
- Ne change pas le sens du cours et ne t'éloigne pas du contenu présenté dans la prise de notes.

Format de sortie :
- Utilise un HTML lisible dans une page web : <h1>, <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>, <table>, <tr>, <td> si nécessaire.
- Pas de balises <html>, <head> ou <body>, uniquement le contenu.
- Titre principal en <h1>.
- Parties numérotées en <h2> (1., 2., 3., ...).
- Tu peux utiliser des listes, des tableaux ou des encadrés (sous forme de <div> avec un titre) pour représenter les schémas.

Donne UNIQUEMENT le HTML de la fiche, sans texte explicatif autour.
`;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const summary = response.text();

    res.json({ summary });
  } catch (error) {
    console.error("Erreur Gemini:", error);
    res
      .status(500)
      .json({ error: "Erreur lors de la génération de la fiche via l'IA." });
  }
});

// Endpoint d'upload PDF
app.post("/api/upload-pdf", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Aucun fichier reçu" });
  }

  try {
    const bucket = storage.bucket();
    const fileName = `pdfs/${Date.now()}_${req.file.originalname}`;
    const file = bucket.file(fileName);

    await file.save(req.file.buffer, {
      metadata: {
        contentType: req.file.mimetype,
      },
    });

    const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(fileName)}?alt=media`;

    res.json({ fileUrl: url });
  } catch (err) {
    console.error("Erreur upload PDF:", err);
    res.status(500).json({ error: "Erreur lors de l'upload du PDF" });
  }
});

app.listen(PORT, () => {
  console.log(`Backend en écoute sur http://localhost:${PORT}`);
});




