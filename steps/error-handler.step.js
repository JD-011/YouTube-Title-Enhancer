// step - 6:
// 

export const config = {
  name: "ErrorHandler",
  type: "event",
  subscribes: ["yt.channel.error", "yt.videos.error", "yt.titles.error"],
  emits: ["yt.error.notified"]
}

export const handler = async (eventData, {emit, logger, state}) => {
    try {
        const jobId = eventData.jobId
        const email = eventData.email
        const error = eventData.error

        logger.info("Handling error notification", {jobId, email, error})

        const resendApiKey = process.env.RESEND_API_KEY
        const resendEmail = process.env.RESEND_FROM_EMAIL
        if(!resendApiKey) {
            throw new Error("Resend API key not configured")
        }
        if(!resendEmail) {
            throw new Error("Resend email not configured")
        }

        const jobData = await state.get("jobs", jobId)
        await state.set("jobs", jobId, {
            ...jobData,
            status: "sending email",
        })

        const emailText = `Dear User, We are facing some issues while processing your request.\n\nError Details: ${error}`

        const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${resendApiKey}`
            },
            body: JSON.stringify({
                from: resendEmail,
                to: email,
                subject: `Request failed for YouTube Title Doctor`,
                text: emailText
            })
        })

        if(!response.ok) {
            const errorData = await response.json()
            throw new Error(`Resend API error: ${errorData.message || 'Unknown error'}`)
        }

        const emailResult = await response.json()

        logger.info("Error notification email sent", {jobId, emailId: emailResult.id})

        await state.set("jobs", jobId, {
            ...jobData,
            status: "error notification email sent",
            emailId: emailResult.id,
            completedAt: new Date().toISOString()
        })

        await emit({
            topic: "yt.error.notified",
            data: {
                jobId,
                email,
                emailId: emailResult.id
            }
        })

    } catch (err) {
        logger.error("Failed to send error notification email", {error: err.message})
    }
}