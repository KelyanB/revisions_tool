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
Ton rôle est de transformer la prise de notes ci‑dessous en fiche de révision, SANS ajouter de connaissances extérieures ni inventer d'informations.

Nom du cours : ${name}
Description du cours :
${description}

Consignes d'organisation données par l'étudiant :
${details}

Texte de prise de notes (source UNIQUE, à respecter strictement) :
"""
${baseText}
"""

Règles OBLIGATOIRES :
- Tu dois te baser EXCLUSIVEMENT sur le texte de prise de notes ci‑dessus.
- N'ajoute PAS de définitions, d'exemples, de théories ou de parties qui ne sont pas présentes dans le texte de prise de notes.
- Si une notion n'apparaît pas dans le texte de prise de notes, tu ne l'inventes pas.
- Tu peux reformuler et réorganiser, mais le contenu doit rester équivalent à celui de la prise de notes.
- Tu dois conserver toutes les informations importantes présentes dans le texte initial (rien d'essentiel ne doit disparaître).

Format de la fiche (HTML simple uniquement) :
- Un titre principal du cours en <h1>.
- Parties numérotées en <h2> (1., 2., 3., ...), correspondant aux grandes sections du cours dans les notes.
- Sous-parties en <h3> si nécessaire.
- Listes à puces avec <ul><li> pour les définitions, exemples, points clés.
- Mets en évidence les notions importantes avec <strong>.
- Pas de balises <html>, <head> ou <body>, uniquement le contenu à afficher.
- Style concis, adapté à un étudiant qui révise la Licence Pro Banque.
- Fiche en français.

Important :
- Ta mission est de faire une fiche de révision propre, claire et structurée, mais basée UNIQUEMENT sur le texte fourni.
- Ne rajoute pas d'éléments extérieurs, même si tu connais le sujet.

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



