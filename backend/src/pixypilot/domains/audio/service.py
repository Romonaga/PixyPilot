import re

from pixypilot.core.commands import AsyncCommandRunner, CommandError
from pixypilot.domains.audio.models import AudioCommandResult, AudioStatus

PIXY_AUDIO_NAME = "EMEET PIXY"
MIC_SWITCH_NUMID = "2"

CARD_LINE_RE = re.compile(r"card\s+(?P<card>\d+):\s+(?P<short>[^\[]+)\[(?P<long>[^\]]+)\]")
VALUE_RE = re.compile(r": values=(?P<value>.+)")


class AudioService:
    def __init__(self, runner: AsyncCommandRunner | None = None) -> None:
        self.runner = runner or AsyncCommandRunner()

    async def status(self) -> AudioStatus:
        card = await self.find_pixy_card()
        if card is None:
            return AudioStatus(available=False, reason="EMEET PIXY audio capture device was not found")

        try:
            contents = await self._card_contents(card)
        except CommandError as exc:
            return AudioStatus(available=False, card=card, reason=str(exc))

        muted = _parse_mic_muted(contents)
        volume = _parse_mic_volume(contents)
        return AudioStatus(
            available=muted is not None,
            card=card,
            name=PIXY_AUDIO_NAME,
            muted=muted,
            volume=volume,
            reason=None if muted is not None else "Mic Capture Switch was not found",
        )

    async def set_mute(self, muted: bool) -> AudioCommandResult:
        card = await self.find_pixy_card()
        if card is None:
            raise FileNotFoundError("EMEET PIXY audio capture device was not found")

        value = "off" if muted else "on"
        await self.runner.run(["amixer", "-c", str(card), "cset", f"numid={MIC_SWITCH_NUMID}", value])
        return AudioCommandResult(ok=True, command="mic_mute", value=muted, card=card)

    async def find_pixy_card(self) -> int | None:
        try:
            result = await self.runner.run(["arecord", "-l"])
        except CommandError:
            return None
        return _parse_pixy_card(result.stdout)

    async def _card_contents(self, card: int) -> str:
        result = await self.runner.run(["amixer", "-c", str(card), "contents"])
        return result.stdout


def _parse_pixy_card(output: str) -> int | None:
    for line in output.splitlines():
        match = CARD_LINE_RE.search(line)
        if not match:
            continue
        if "EMEET PIXY" in line:
            return int(match.group("card"))
    return None


def _parse_mic_muted(output: str) -> bool | None:
    switch_block = _control_block(output, "Mic Capture Switch")
    if switch_block is None:
        return None
    value = _parse_value(switch_block)
    if value is None:
        return None
    return value.strip().lower() == "off"


def _parse_mic_volume(output: str) -> int | None:
    volume_block = _control_block(output, "Mic Capture Volume")
    if volume_block is None:
        return None
    value = _parse_value(volume_block)
    if value is None:
        return None
    try:
        return int(value.strip())
    except ValueError:
        return None


def _control_block(output: str, control_name: str) -> str | None:
    lines = output.splitlines()
    for index, line in enumerate(lines):
        if f"name='{control_name}'" not in line:
            continue
        block_lines = [line]
        for following in lines[index + 1 :]:
            if following.startswith("numid="):
                break
            block_lines.append(following)
        return "\n".join(block_lines)
    return None


def _parse_value(block: str) -> str | None:
    for line in block.splitlines():
        match = VALUE_RE.search(line.strip())
        if match:
            return match.group("value")
    return None


def get_audio_service() -> AudioService:
    return AudioService()
