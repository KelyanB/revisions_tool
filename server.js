import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
const PORT = 4000;

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("Erreur: GEMINI_API_KEY manquante dans le fichier .env");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

app.use(cors());
app.use(express.json());

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
À partir du document suivant (prise de notes d'étudiant) et des consignes, génère une fiche synthèse claire et structurée en reprenant les mêmes informations que sur la prise de note.

Nom du cours : ${name}
Description du cours :
${description}

Consignes d'organisation données par l'étudiant :
${details}

Texte de prise de notes :
"""
${baseText}
"""

Contraintes pour la fiche :
- Génère la fiche au format HTML simple (<h1>, <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>).
- Pas de balise <html>, <head> ou <body>, uniquement le contenu.
- Titre principal du cours en <h1>.
- Parties numérotées en <h2> (1., 2., 3., ...).
- Sous-parties en <h3> si nécessaire.
- Listes à puces avec <ul><li> pour les définitions, exemples, points clés.
- Mets en évidence les notions importantes avec <strong>.
- Tu peux ajouter quelques emojis pertinents (mais pas trop) pour rendre la fiche agréable à lire.
- Style concis, adapté à un étudiant qui révise la Licence Pro Banque.
- Fiche en français.
- Récupérer l'entièreté des informations noté sur la prise de note, et bien remplir la fiche synthèse

Donne uniquement le HTML de la fiche, sans texte explicatif autour.
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

app.listen(PORT, () => {
  console.log(`Backend en écoute sur http://localhost:${PORT}`);
});
