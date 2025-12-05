// step - 2:
// Converts youtube channel handle/name to channel ID usind youtube data api

export const config = {
  name: "ResolveChannel",
  type: "event",
  subscribes: ["yt.submit"],
  emits: ["yt.channel.resolved", "yt.channel.error"]
}

export const handler = async (eventData, {emit, logger, state}) => {
    let jobId
    let email

    try {
        jobId = eventData.jobId
        email = eventData.email
        const channel = eventData.channel

        logger.info("Resolving youtube channel", {jobId, channel})

        const youtubeApiKey = process.env.YOUTUBE_API_KEY
        if(!youtubeApiKey) {
            throw new Error("YouTube API key not configured")
        }

        const jobData = await state.get("jobs", jobId)
        await state.set("jobs", jobId, {
            ...jobData,
            status: "resolving channel",
        })

        let handle
        if(channel.startsWith("@")){
            handle = channel.substring(1);
        } else {
            handle = channel
        }

        const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults=1&q=${encodeURIComponent(handle)}&key=${youtubeApiKey}`

        const searchResponse = await fetch(searchUrl)
        const searchData = await searchResponse.json()

        let channelId
        let channelName

        if(searchData.items && searchData.items.length > 0) {
            channelId = searchData.items[0].snippet.channelId
            channelName = searchData.items[0].snippet.title
        }
        
        if(!channelId){
            logger.info("Channel not found", {jobId, channel, searchData})

            await state.set("jobs", jobId, {
                ...jobData,
                status: "failed",
                error: "Channel not found"
            })
            
            await emit({
                topic: "yt.channel.error",
                data: {
                    jobId,
                    email,
                    error: "Channel not found"
                }
            })
            
            return
        }

        logger.info("Channel resolved", {jobId, channelId, channelName})

        await state.set("jobs", jobId, {
            ...jobData,
            channelId,
            channelName,
            status: "channel resolved",
        })

        await emit({
            topic: "yt.channel.resolved",
            data: {
                jobId,
                email,
                channelId,
                channelName
            }
        })
    } catch (err) {
        logger.error("Error resolving channel", {error: err.message})

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
            topic: "yt.channel.error",
            data: {
                jobId,
                email,
                error: "Failed to resolve channel, please try again later"
            }
        })
    }
}