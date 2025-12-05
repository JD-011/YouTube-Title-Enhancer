// step - 5:
// Sends formated email with improved titles to the user using Resend

const generateEmailText = (channelName, improvedTitles) => {
    let text = `YouTube Title Doctor - Improved Titles for "${channelName}"\n`
    text += `${"=".repeat(60)}\n\n`

    improvedTitles.forEach((title, idx) => {
        text += `Video ${idx + 1}:\n`
        text += `--------------------------\n`
        text += `Original Title: ${title.originalTitle}\n`
        text += `Improved Title: ${title.improvedTitle}\n`
        text += `Why: ${title.rational}\n`
        text += `Video URL: ${title.url}\n\n`
    })

    text += `${"=".repeat(60)}\n\n`
    text += `Powred by Motia.dev\n`

    return text
}

export const config = {
  name: "SendEmail",
  type: "event",
  subscribes: ["yt.titles.generated"],
  emits: ["yt.email.sent", "yt.email.error"]
}

export const handler = async (eventData, {emit, logger, state}) => {
    try {
        const jobId = eventData.jobId
        const email = eventData.email
        const channelName = eventData.channelName
        const improvedTitles = eventData.improvedTitles

        logger.info("Sending email", {jobId, email, titleCount: improvedTitles.length})

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

        const emailText = generateEmailText(channelName, improvedTitles)

        const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${resendApiKey}`
            },
            body: JSON.stringify({
                from: resendEmail,
                to: email,
                subject: `Improved YouTube Titles for "${channelName}"`,
                text: emailText
            })
        })

        if(!response.ok) {
            const errorData = await response.json()
            throw new Error(`Resend API error: ${errorData.message || 'Unknown error'}`)
        }

        const emailResult = await response.json()

        logger.info("Email sent successfully", {jobId, emailId: emailResult.id})

        await state.set("jobs", jobId, {
            ...jobData,
            status: "email sent",
            emailId: emailResult.id,
            completedAt: new Date().toISOString()
        })

        await emit({
            topic: "yt.email.sent",
            data: {
                jobId,
                email,
                emailId: emailResult.id
            }
        })

    } catch (err) {
        logger.error("Error sending email", {error: err.message})

        const jobData = await state.get("jobs", jobId)
        await state.set("jobs", jobId, {
            ...jobData,
            status: "failed",
            error: err.message
        })

        await emit({
            topic: "yt.email.error",
            data: {
                jobId,
                email,
                error: "Failed to send email."
            }
        })
    }
}