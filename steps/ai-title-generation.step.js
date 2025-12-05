// step - 4:
// Uses Gemini to generate improved titles for the fetched videos

import { GoogleGenAI } from "@google/genai"

const ai = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY})

export const config = {
  name: "GenerateTitles",
  type: "event",
  subscribes: ["yt.videos.fetched"],
  emits: ["yt.titles.generated", "yt.titles.error"]
}

export const handler = async (eventData, {emit, logger, state}) => {
    let jobId
    let email

    try {
        jobId = eventData.jobId
        email = eventData.email
        const channelName = eventData.channelName
        const videos = eventData.videos

        logger.info("Generating titles for videos", {jobId, channelName, videoCount: videos.length})

        const geminiApiKey = process.env.GEMINI_API_KEY
        if(!geminiApiKey) {
            throw new Error("Gemini API key not configured")
        }

        const jobData = await state.get("jobs", jobId)
        await state.set("jobs", jobId, {
            ...jobData,
            status: "generating titles",
        })

        const videoTitles = videos.map((video, idx) => `${idx+1}. "${video.title}"`).join("\n")

        const promt = `You are a YouTube title optimization expert. Below are ${videos.length} videos title from the channel "${channelName}".
        
        For each title, provide:
        1. An improved version that is more engaging, SEO-friendly, and likely to get more clicks
        2. A brief rational (1-2 sentences) explaining why the new title is better
        
        Guideelines:
        - Keep the core topic and authenticity
        - Use action verbs, numbers, and specific value propositions
        - Make it curiosity-inducing without being clickbait
        - Optimize for searchability and clarity
        
        Video Titles:
        ${videoTitles}
        
        Respond in JSON format:
        {
            "titles": [
                {
                    "original": "...",
                    "improved": "...",
                    "rational": "..."
                }
            ]
        }`

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: promt,
            config: {
                systemInstruction: "You are a YouTube SEO and engagement expert who helps creators write better video titles",
                temperature: 0.7,
                responseMimeType: "application/json"
            }
        })

        if(!response || !response.text) {
            throw new Error("Error generating titles: Invalid response from AI")
        }

        const aiResponse = JSON.parse(response.text)

        const improvedTitles = aiResponse.titles.map((title, index) => ({
            videoId: videos[index].videoId,
            originalTitle: title.original,
            improvedTitle: title.improved,
            rational: title.rational,
            url: videos[index].url
        }))

        logger.info("Titles generated successfully", {jobId, count: improvedTitles.length, improvedTitles})

        await state.set("jobs", jobId, {
            ...jobData,
            status: "titles generated",
            improvedTitles
        })

        await emit({
            topic: "yt.titles.generated",
            data: {
                jobId,
                email,
                channelName,
                improvedTitles
            }
        })
        
    } catch (err) {
        logger.error("Error generating titles", {error: err.message})

        if(!jobId || !email) {
            logger.error("cannot send error notification, missing jobId or email")
            return
        }

        const jobData = await state.get("jobs", jobId)
        await state.set("jobs", jobId, {
            ...jobData,
            status: "failed",
            error: err.message
        })

        await emit({
            topic: "yt.titles.error",
            data: {
                jobId,
                email,
                error: "Failed to generate titles, please try again later."
            }
        })
    }
}