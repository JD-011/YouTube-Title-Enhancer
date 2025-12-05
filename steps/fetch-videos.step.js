// step - 3:
// Retrives the latest 5 videos from the resolved channel ID

export const config = {
  name: "FetchVideos",
  type: "event",
  subscribes: ["yt.channel.resolved"],
  emits: ["yt.videos.fetched", "yt.videos.error"]
}

export const handler = async (eventData, {emit, logger, state}) => {
    let jobId
    let email

    try {
        jobId = eventData.jobId
        email = eventData.email
        const channelId = eventData.channelId
        const channelName = eventData.channelName

        logger.info("Fetching videos from youtube channel", {jobId, channelId, channelName})

        const youtubeApiKey = process.env.YOUTUBE_API_KEY
        if(!youtubeApiKey) {
            throw new Error("YouTube API key not configured")
        }

        const jobData = await state.get("jobs", jobId)
        await state.set("jobs", jobId, {
            ...jobData,
            status: "fetching videos",
        })

        const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${encodeURIComponent(channelId)}&maxResults=5&order=date&type=video&maxResults=5&key=${youtubeApiKey}`

        const responce = await fetch(searchUrl)
        const data = await responce.json()

        if(!data.items || data.items.length === 0){
            logger.warn("No videos found for channel", {jobId, channelId, channelName})

            await state.set("jobs", jobId, {
                ...jobData,
                status: "failed",
                error: "No videos found"
            })

            await emit({
                topic: "yt.videos.error",
                data: {
                    jobId,
                    email,
                    error: "No videos found for this channel"
                }
            })

            return
        }

        const videos = data.items.map(item => ({
            videoId: item.id.videoId,
            title: item.snippet.title,
            url: `https://www.youtube.com//watch?v=${item.id.videoId}`,
            publishedAt: item.snippet.publishedAt,
            thumbnail: item.snippet.thumbnails.default.url
        }))

        logger.info("Videos fetched succesfully", {jobId, videoCount: videos.length, videos})

        await state.set("jobs", jobId, {
            ...jobData,
            status: "videos fetched",
            videos
        })

        await emit({
            topic: "yt.videos.fetched",
            data: {
                jobId,
                email,
                channelName,
                videos
            }
        })

    } catch (err) {
        logger.error("Error fetching videos", {error: err.message})

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
            topic: "yt.videos.error",
            data: {
                jobId,
                email,
                error: "Failed to fetch videos, please try again later."
            }
        })
    }
}