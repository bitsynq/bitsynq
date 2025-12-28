/**
 * Meeting Parser Service
 *
 * Parses Zoom AI Meeting Summary format and extracts
 * participant contributions for automatic ratio calculation.
 *
 * Expected format:
 * - Quick recap: Brief summary
 * - Next steps: Action items with assignee names
 * - Summary: Detailed meeting content with section headers
 */

import type { ParsedMeetingData, ParsedParticipant } from '../types';

// Keywords that indicate significant contributions (for scoring)
const CONTRIBUTION_KEYWORDS = [
	// High-impact actions
	{ pattern: /complete|finish|implement|develop|build|create|design/i, weight: 3, category: 'implementation' },
	{ pattern: /決定|決議|同意|通過|確認|完成|實作|開發/i, weight: 3, category: 'decision' },
	// Medium-impact actions
	{ pattern: /contact|schedule|share|get|obtain|access|figure out/i, weight: 2, category: 'coordination' },
	{ pattern: /提案|建議|提議|提出|聯繫|分享|取得/i, weight: 2, category: 'proposal' },
	// Lower-impact actions
	{ pattern: /continue|try|explore|discuss/i, weight: 1, category: 'ongoing' },
	{ pattern: /繼續|嘗試|探索|討論/i, weight: 1, category: 'discussion' },
];

/**
 * Parse Zoom AI Meeting Summary format
 */
export function parseMeetingTranscript(transcript: string): ParsedMeetingData {
	const lines = transcript.split('\n').filter(line => line.trim());

	// Extract sections
	const quickRecap = extractSection(transcript, 'Quick recap');
	const nextSteps = extractSection(transcript, 'Next steps');
	const summary = extractSection(transcript, 'Summary');

	// Extract meeting title from first line or Summary section headers
	const meetingTitle = extractMeetingTitle(lines);

	// Parse Next Steps to extract participant contributions
	// This is the primary source of contribution data
	const participantActions = parseNextSteps(nextSteps);

	// Also check Summary section for additional mentions
	const summaryMentions = parseSummaryForMentions(summary);

	// Merge participant data
	const participantMap = new Map<string, {
		name: string;
		actions: string[];
		score: number;
		keywords: Set<string>;
	}>();

	// Process Next Steps (primary source)
	for (const action of participantActions) {
		if (!participantMap.has(action.name)) {
			participantMap.set(action.name, {
				name: action.name,
				actions: [],
				score: 0,
				keywords: new Set(),
			});
		}
		const participant = participantMap.get(action.name)!;
		participant.actions.push(action.task);

		// Calculate score based on keywords
		let actionScore = 1; // Base score for having an action item
		for (const kw of CONTRIBUTION_KEYWORDS) {
			if (kw.pattern.test(action.task)) {
				participant.keywords.add(kw.category);
				actionScore += kw.weight;
			}
		}
		participant.score += actionScore;
	}

	// Add summary mentions (bonus points for being mentioned prominently)
	for (const mention of summaryMentions) {
		if (!participantMap.has(mention.name)) {
			participantMap.set(mention.name, {
				name: mention.name,
				actions: [],
				score: 0,
				keywords: new Set(),
			});
		}
		const participant = participantMap.get(mention.name)!;
		participant.score += mention.mentions * 0.5; // Bonus for being mentioned
	}

	// Calculate total score and ratios
	let totalScore = 0;
	for (const p of participantMap.values()) {
		totalScore += p.score;
	}

	// Build result
	const participants: ParsedParticipant[] = [];
	for (const [name, data] of participantMap) {
		participants.push({
			name: data.name,
			matched_user_id: undefined,
			speak_count: data.actions.length,
			estimated_duration_seconds: data.actions.length * 60, // Rough estimate
			keywords_found: Array.from(data.keywords),
			score: data.score,
			suggested_ratio: totalScore > 0
				? parseFloat(((data.score / totalScore) * 100).toFixed(2))
				: 0,
		});
	}

	// Sort by ratio descending
	participants.sort((a, b) => b.suggested_ratio - a.suggested_ratio);

	// Calculate confidence
	const parseConfidence = calculateConfidence(participants, nextSteps, summary);

	return {
		participants,
		meeting_title: meetingTitle,
		meeting_date: undefined, // Zoom format doesn't include date in transcript
		total_duration_seconds: participants.reduce((sum, p) => sum + p.estimated_duration_seconds, 0),
		parse_confidence: parseConfidence,
	};
}

/**
 * Extract a section from the transcript
 */
function extractSection(transcript: string, sectionName: string): string {
	// Handle various section header formats
	const patterns = [
		new RegExp(`^${sectionName}\\s*$`, 'im'),
		new RegExp(`^## ${sectionName}\\s*$`, 'im'),
		new RegExp(`^### ${sectionName}\\s*$`, 'im'),
	];

	for (const pattern of patterns) {
		const match = transcript.match(pattern);
		if (match && match.index !== undefined) {
			const start = match.index + match[0].length;
			// Find next section (any line that looks like a header)
			const nextSectionMatch = transcript.slice(start).match(/^(?:#{1,3}\s+)?(?:Quick recap|Next steps|Summary|Meeting summary)\s*$/im);
			const end = nextSectionMatch && nextSectionMatch.index !== undefined
				? start + nextSectionMatch.index
				: transcript.length;
			return transcript.slice(start, end).trim();
		}
	}
	return '';
}

/**
 * Split combined names like "Saad and Sunny"
 */
function splitCombinedNames(name: string): string[] {
	if (name.includes(' and ')) {
		return name.split(' and ').map(n => n.trim());
	}
	if (name.includes(' & ')) {
		return name.split(' & ').map(n => n.trim());
	}
	if (name.includes(',')) {
		return name.split(',').map(n => n.trim());
	}
	return [name];
}

/**
 * Parse Next Steps section to extract action items
 *
 * Expected formats:
 * - "和融: Complete the token sender design..."
 * - "胡舜元: Get Mohammad's Colby assessment..."
 */
function parseNextSteps(nextStepsSection: string): Array<{ name: string; task: string }> {
	const actions: Array<{ name: string; task: string }> = [];
	const lines = nextStepsSection.split('\n');

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;

		// Pattern: "Name: Task description"
		// Supports both English and Chinese colons
		const match = trimmed.match(/^([^:：]+)[：:]\s*(.+)$/);
		if (match) {
			const rawName = match[1].trim();
			const task = match[2].trim();

			if (!isHeaderLine(rawName)) {
				// Handle combined names e.g. "Saad and Sunny"
				const names = splitCombinedNames(rawName);

				for (const name of names) {
					// Filter out common words and very short names (unless Chinese)
					if (isCommonWord(name)) continue;

					// English names usually > 2 chars, Chinese > 1
					const isChinese = /[\u4e00-\u9fff]/.test(name);
					if (name.length < 2 && !isChinese) continue;

					if (name.length > 40) continue; // Name too long, likely text

					actions.push({ name, task });
				}
			}
		}
	}

	return actions;
}

/**
 * Check if a line looks like a section header
 */
function isHeaderLine(text: string): boolean {
	const headers = [
		'quick recap', 'next steps', 'summary', 'meeting summary',
		'action items', 'notes', 'discussion', 'agenda'
	];
	return headers.includes(text.toLowerCase());
}

/**
 * Parse Summary section for participant mentions
 */
function parseSummaryForMentions(summarySection: string): Array<{ name: string; mentions: number }> {
	// Extract names from section headers in Summary
	// Format: "Weekly Wins and Body Progress" followed by mentions of names

	const mentionMap = new Map<string, number>();

	// Look for names in the text (Chinese names are typically 2-4 characters)
	// This is a simplified approach - in production, you might use NER
	const chineseNamePattern = /(?:^|[^a-zA-Z\u4e00-\u9fff])([胡黃李張陳王林劉楊吳趙周徐孫朱馬郭何高羅鄭梁][a-zA-Z\u4e00-\u9fff]{1,3})(?:[^a-zA-Z\u4e00-\u9fff]|$)/g;
	const englishNamePattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g;

	// Count Chinese name mentions
	let match;
	while ((match = chineseNamePattern.exec(summarySection)) !== null) {
		const name = match[1];
		mentionMap.set(name, (mentionMap.get(name) || 0) + 1);
	}

	// Count English name mentions
	while ((match = englishNamePattern.exec(summarySection)) !== null) {
		const name = match[1];
		// Filter out common words that look like names
		if (!isCommonWord(name)) {
			mentionMap.set(name, (mentionMap.get(name) || 0) + 1);
		}
	}

	return Array.from(mentionMap.entries()).map(([name, mentions]) => ({ name, mentions }));
}

/**
 * Check if word is a common English word or term to ignore
 */
function isCommonWord(word: string): boolean {
	// Case-insensitive check
	const lower = word.toLowerCase();
	const commonWords = new Set([
		'the', 'this', 'that', 'these', 'those', 'here', 'there', 'they', 'them', 'their',
		'he', 'she', 'it', 'we', 'you', 'i', 'us',
		'meeting', 'summary', 'project', 'team', 'work', 'week',
		'monday', 'tuesday', 'wednesday', 'thursday', 'friday',
		'january', 'february', 'march', 'april', 'may', 'june',
		'july', 'august', 'september', 'october', 'november', 'december',
		'chatgpt', 'bitsync', 'ethereum', 'layer', 'token', 'blockchain',
		'strategic coach', 'ascender gmail', 'code', 'codex', 'white paper', 'development',
		'bitcoin', 'zoom', 'update', 'update the', 'creation strategy',
		'democratization trends', 'personal', 'academic achievements'
	]);
	return commonWords.has(lower);
}

/**
 * Extract meeting title
 */
function extractMeetingTitle(lines: string[]): string | undefined {
	// Check first line for "Meeting summary" header
	if (lines.length > 0 && /meeting summary/i.test(lines[0])) {
		// Look for next non-empty line as potential title
		for (let i = 1; i < Math.min(lines.length, 5); i++) {
			const line = lines[i].trim();
			if (line && !line.match(/^(Quick recap|Next steps|Summary)/i)) {
				return line;
			}
		}
	}

	// Check Summary section for first header
	for (const line of lines) {
		if (line.match(/^[A-Z][\w\s]+$/)) {
			return line.trim();
		}
	}

	return undefined;
}

/**
 * Calculate parsing confidence
 */
function calculateConfidence(
	participants: ParsedParticipant[],
	nextSteps: string,
	summary: string
): number {
	if (participants.length === 0) return 0;

	let confidence = 0;

	// Factor 1: Number of participants with action items (max 40 points)
	const participantsWithActions = participants.filter(p => p.speak_count > 0).length;
	confidence += Math.min(participantsWithActions * 15, 40);

	// Factor 2: Total action items (max 30 points)
	const totalActions = participants.reduce((sum, p) => sum + p.speak_count, 0);
	confidence += Math.min(totalActions * 5, 30);

	// Factor 3: Next steps section exists and has content (20 points)
	if (nextSteps.length > 50) {
		confidence += 20;
	}

	// Factor 4: Summary section has content (10 points)
	if (summary.length > 100) {
		confidence += 10;
	}

	return Math.min(confidence, 100);
}

/**
 * Match participant names to project members
 */
export function matchParticipantsToMembers(
	participants: ParsedParticipant[],
	members: Array<{ id: string; display_name: string; email: string; aliases?: string[] | string }>
): ParsedParticipant[] {
	return participants.map(participant => {
		const participantName = participant.name.toLowerCase().trim();

		// Try to find a matching member
		const match = members.find(member => {
			const memberName = member.display_name.toLowerCase().trim();
			const emailPrefix = member.email.split('@')[0].toLowerCase();

			// 1. Exact match on display_name or email prefix
			if (participantName === memberName) return true;
			if (participantName === emailPrefix) return true;

			// 2. Check aliases
			if (member.aliases) {
				let aliases: string[] = [];
				if (Array.isArray(member.aliases)) {
					aliases = member.aliases;
				} else if (typeof member.aliases === 'string') {
					try {
						aliases = JSON.parse(member.aliases);
					} catch (e) {
						// Ignore parse error
					}
				}

				if (aliases.some(alias => alias.toLowerCase().trim() === participantName)) {
					return true;
				}
			}

			// 3. Partial match (contains) - only if name is long enough to be significant
			if (participantName.length > 3) {
				if (memberName.includes(participantName)) return true;
				if (participantName.includes(memberName)) return true;
				if (emailPrefix.includes(participantName)) return true;
			}

			// 4. Handle Chinese names (usually 2-3 chars, strict match)
			// "和融" matches "黃和融"
			if (/[\u4e00-\u9fff]/.test(participantName) && participantName.length >= 2) {
				if (memberName.includes(participantName)) return true;
			}

			return false;
		});

		return {
			...participant,
			matched_user_id: match?.id,
		};
	});
}
