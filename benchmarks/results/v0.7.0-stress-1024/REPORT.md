# Assay Design multidomain stress: 1,024 subjects

| Measurement | Result |
| --- | ---: |
| AVP criterion verdicts | 8,192 |
| Failures detected | 512/512 |
| False alarms | 0 |
| Determinism drift | 0/100 |
| Large surface | 50,000 nodes in 32.48 ms |
| Subjects per second | 13,214.11 |
| Overall | PASS |

## Limits

- The corpus is deterministic and synthetic.
- Timing is observational and is not a cross-machine pass threshold.
- The stress test exercises lint evidence plus AVP verdict aggregation, not Figma or browser rendering latency.
