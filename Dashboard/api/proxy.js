// api/proxy.js
export default async function handler(req, res) {
  try {
    // Fetch from the old API
    const response = await fetch(
      "http://68.219.251.214/api/db_api/api/v1/getData"
    );

    if (!response.ok) {
      throw new Error("Failed to fetch from the old API");
    }

    const data = await response.json();

    // Send the data back to the frontend
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
