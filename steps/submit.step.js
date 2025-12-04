// step - 1:
// Accept channel name and email to start the worlkflow

export const config = {
  name: "SubmitChannel",
  type: "api",
  path: "/submit",
  method: "POST",
  emits: ["yt.submit"]
}
 
export const handler = async (req, {emit, logger, state}) => {
    try {
        logger.info("recived submission request", {body: req.body})

        const {channel, email} = req.body

        if (!channel || !email) {
            return {
                status: 400,
                body: {
                    error: "Missing channle name or email"
                }
            }
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
            return {
                status: 400,
                body: {
                    error: "Invalid email format"
                }
            }
        }

        const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

        await state.set("jobs", jobId, {
            jobId,
            channel,
            email,
            status: "queued",
            createdAt: new Date().toISOString()
        })

        logger.info("Job created", {jobId, channel, email})

        await emit({
            topic: "yt.submit",
            data: {jobId, channel, email}
        })

        return {
            status: 202,
            body: {
                success: true,
                jobId,
                message: "Your request has been queued. You will get an email soon with improved suggetions for your youtube videos"
            }
        }
    } catch (err) {
        logger.error("Error Submiting channel", {error: err.message})

        return {
            status: 500,
            body: {error: "Internal Server Error"}
        }
    }
}