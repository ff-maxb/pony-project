import { Inngest } from "inngest";

export const inngest = new Inngest({
	id: "pony-project",
	...(process.env.INNGEST_EVENT_KEY ? { eventKey: process.env.INNGEST_EVENT_KEY } : {}),
	...(process.env.INNGEST_BASE_URL ? { baseUrl: process.env.INNGEST_BASE_URL } : {}),
});
