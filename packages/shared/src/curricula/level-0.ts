import type { CurriculumData } from "../curricula";

export const level0Curriculum: CurriculumData = {
  meta: {
    profile: "level-0",
    title: "Level 0",
    starting_position:
      "Complete beginner to software pilotry. No prior programming experience required. This track introduces the fundamental concepts of what software is, how AI agents generate it, and why human oversight matters.",
    tutor_guidance:
      "The learner is a complete beginner. Use simple, concrete language. Avoid jargon. Build understanding through real-world analogies. The goal is to establish foundational mental models before any technical depth. When the learner seems confused, simplify rather than elaborate.",
  },
  modules: [
    {
      id: "1",
      title: "The New Landscape",
      sections: [
        {
          id: "0.1",
          title: "The New Landscape",
          key_intuition: "AI agents now generate working software from plain English. The barrier to building software is gone. What follows is not a golden age of creation but an explosion of software produced without quality supports.",
          markdown: "## The New Landscape\n\nWhat changed, who builds software now, and why accountability matters.\n\nAI coding agents can generate working applications from natural language. The technical barrier to building software is gone. What follows is not a golden age of democratised creation - it is an explosion of software produced without any of the traditional quality supports: no code review, no architectural oversight, no professional accountability.\n\n**Three roles, not two.** The public conversation frames this as 'AI replaces developers.' The reality is three roles: the domain expert who knows the problem, the agent that generates code, and the pilot who takes responsibility for whether the software actually works, is secure, and does what it should.\n\n**The accountability question.** AI agents cannot be sued, fired, or held professionally responsible. When generated software causes harm - data breach, financial loss, safety incident - someone must own the outcome. The pilot is the answer.",
        },
      ],
    },
    {
      id: "2",
      title: "The Machine Beneath",
      sections: [
        {
          id: "0.2",
          title: "The Machine Beneath",
          key_intuition: "Software is precise, literal, and layered. The computer does exactly what it's told, nothing more, nothing less. Understanding this precision is the foundation for evaluating AI-generated code.",
          markdown: "## The Machine Beneath\n\nCompilers, HTTP, databases, DevTools - the reality under the abstraction.\n\nThe compiler moment - software is precise, literal, and layered. The learner experiences the machine executing exact instructions. Every line of code is an instruction. The computer follows them literally. There is no 'what I meant' - only 'what I said.'\n\n**Variables and types.** Data has types. Mixing them causes errors. The computer doesn't guess what you meant.\n\n**The web stack.** HTTP requests, responses, status codes. How browsers talk to servers. What happens between clicking a button and seeing a result.\n\n**Databases.** Where data lives permanently. How it's structured, queried, and protected.",
        },
      ],
    },
    {
      id: "3",
      title: "The Probabilistic Machine",
      sections: [
        {
          id: "0.3",
          title: "The Probabilistic Machine",
          key_intuition: "AI agents are confident, variable, and frequently wrong. Unlike the deterministic machine beneath, the probabilistic machine above gives different answers to the same question and doesn't know when it's wrong.",
          markdown: "## The Probabilistic Machine\n\nTemperature, hallucination, cognitive surrender - why AI is confident and wrong.\n\nThe stochastic moment - AI agents are confident, variable, and wrong. The learner experiences the contrast between the precise machine beneath and the probabilistic machine above.\n\n**How LLMs work.** Token prediction, not understanding. Pattern matching at scale. Why the same prompt gives different answers.\n\n**Hallucination.** The agent generates plausible-sounding content that is factually wrong. It doesn't know it's wrong. It can't tell you when it's wrong.\n\n**Cognitive surrender.** The temptation to stop thinking because the AI sounds confident. This is the most dangerous failure mode for pilots.",
        },
      ],
    },
    {
      id: "4",
      title: "Specification",
      sections: [
        {
          id: "0.4",
          title: "Specification",
          key_intuition: "Writing specifications that constrain the machine's output is the pilot's primary skill. A good specification reduces the variance in agent output and makes verification possible.",
          markdown: "## Specification\n\nWriting specifications that constrain the machine's output.\n\nThe pilot's primary skill is not coding - it is specifying. A specification defines what the software must do with enough precision that the output can be verified.\n\n**Why specifications matter.** Every ambiguity in your specification is a degree of freedom for the agent. Degrees of freedom increase variance. High variance means more evaluation time.\n\n**What to specify.** Data models, error behavior, security requirements, acceptance criteria. These are the things agents get wrong when left unspecified.\n\n**Acceptance criteria.** How you will verify the output is correct. Written before the agent starts, not after.",
        },
      ],
    },
    {
      id: "5",
      title: "Building with Agents",
      sections: [
        {
          id: "0.5",
          title: "Building with Agents",
          key_intuition: "Using AI agents to build from your specification requires a different skill set than writing code. The pilot oversees, verifies, and takes responsibility.",
          markdown: "## Building with Agents\n\nUsing AI agents to build from your specification.\n\nHands-on agent-assisted building. The learner uses current tools to build from a specification, experiencing the gap between 'the agent generated code' and 'the code is correct.'\n\n**The delegation loop.** Specify, delegate, review, refine. Not a one-shot process.\n\n**When to intervene.** Recognising when the agent is stuck, wrong, or going in circles. The pilot's judgment call.\n\n**Verification.** Testing the output against the specification. Not 'does it work' but 'does it do what I specified.'",
        },
      ],
    },
    {
      id: "6",
      title: "Verification and Sustainable Practice",
      sections: [
        {
          id: "0.6",
          title: "Verification and Sustainable Practice",
          key_intuition: "Testing, acceptance, and maintaining human judgment over time. The pilot is the only participant in the system who has limits - and the only one whose judgment degrades with fatigue.",
          markdown: "## Verification and Sustainable Practice\n\nTesting, acceptance, and maintaining human judgment over time.\n\nThe pilot's sign-off - how to know it's right. The pilot is the only participant in this system who has limits - and the only one whose judgment degrades with fatigue.\n\n**Verification strategies.** Code review, testing, property-based testing, adversarial testing. Each catches a different class of problem.\n\n**Sustainable practice.** AI agents never sleep. They are available at 7am on a Sunday. The pilot is the only one who stops. Learning when to stop is as much a pilotry skill as learning when to intervene.\n\n**Accountability.** When you ship agent-generated code, you are making a professional claim: 'I have reviewed this code and I believe it is fit for purpose.'",
        },
      ],
    },
  ],
};
