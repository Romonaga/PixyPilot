from pixypilot.domains.audio.service import _parse_mic_muted, _parse_mic_volume, _parse_pixy_card


def test_parse_pixy_card_from_arecord_output() -> None:
    output = """
card 1: Wireless [Arctis Nova Pro Wireless], device 0: USB Audio [USB Audio]
card 3: PIXY [EMEET PIXY], device 0: USB Audio [USB Audio]
"""

    assert _parse_pixy_card(output) == 3


def test_parse_mic_mute_and_volume_from_amixer_contents() -> None:
    output = """
numid=2,iface=MIXER,name='Mic Capture Switch'
  ; type=BOOLEAN,access=rw------,values=1
  : values=off
numid=3,iface=MIXER,name='Mic Capture Volume'
  ; type=INTEGER,access=rw---R--,values=1,min=0,max=10,step=0
  : values=7
"""

    assert _parse_mic_muted(output) is True
    assert _parse_mic_volume(output) == 7
