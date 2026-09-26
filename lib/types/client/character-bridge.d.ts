/**
 * Bridge between character cards and party members.
 *
 * A character and a companion are two views of the same person, so they convert
 * both ways: a card you shaped on the 角色卡 tab can walk into your party, and a
 * companion you built on the 队伍 tab can be exported as a standard SillyTavern
 * card to chat with or share.
 *
 * The attribute derivation below is deliberately plain and documented rather
 * than clever: the class sets the physical/mental lean, the Big Five scores
 * nudge the rest, and everything lands in a range the party editor can adjust.
 */
import { type CharCard, type PartyMember, type TavernSpec } from '../protocol.ts';
/**
 * Compose the member's standing instruction from whatever the card carries.
 * @param card - the character card, if one exists.
 * @param spec - the builder state, used when the card is thin or absent.
 * @param name - the resolved display name.
 */
export declare function personaFromCard(card: CharCard | null, spec: TavernSpec | null, name: string): string;
/**
 * Turn the character card (or the builder state) into a party member.
 *
 * Derivation, so the numbers are never a mystery:
 * - every attribute starts at 11;
 * - the class adds its lean (a 战士 gets +3 力量, a 法师 +3 智力, ...);
 * - the Big Five scores nudge 体质/智力/感知/魅力 by up to ±3;
 * - hit points follow 体质: 16 + (体质 - 10) * 2.
 * Everything is editable afterwards on the 队伍 tab.
 * @param card - the card to convert, or null to convert the builder state.
 * @param spec - the builder state.
 * @param avatar - the portrait to carry over.
 * @param index - position in the party, used for the id and fallback name.
 */
export declare function memberFromCard(card: CharCard | null, spec: TavernSpec | null, avatar: string, index: number): PartyMember;
/**
 * Turn a party member back into a standard SillyTavern V2 card.
 * @param member - the companion to export.
 */
export declare function cardFromMember(member: PartyMember): CharCard;
/**
 * A shareable team document: the party plus a note about where it came from.
 * @param party - the team to serialize.
 * @param members - the resolved members (the party already carries them).
 */
export declare function teamFileName(party: {
    name: string;
}): string;
