import {
	AlignmentType,
	BorderStyle,
	Document,
	Footer,
	Header,
	HeadingLevel,
	ImageRun,
	Packer,
	PageNumber,
	Paragraph,
	ShadingType,
	Table,
	TableCell,
	TableRow,
	TextRun,
	WidthType
} from 'docx';
import type { MonthlyReportSnapshot } from '#lib/domain/reports.js';

// CDC §6.3: Format A4 portrait, marges 2 cm, police Calibri 11pt, interligne 1.15.
const FONT_FAMILY = 'Calibri';
const BASE_FONT_SIZE = 22; // 11 pt (in half-points)
const DEFAULT_PRIMARY_COLOR = '0C8054'; // Emerald / Zingana Green
const ZINGANA_GOLD = 'B8933A';
const ZEBRA_ROW_COLOR = 'F8F9FA';
const BORDER_COLOR = 'D1D5DB';

function cleanHex(color?: string | null): string {
	if (!color) return DEFAULT_PRIMARY_COLOR;
	return color.replace(/^#/, '').toUpperCase();
}

function parseBase64Image(
	dataUrl?: string | null
): { buffer: Buffer; type: 'png' | 'jpg' | 'gif' | 'bmp' } | null {
	if (!dataUrl || !dataUrl.startsWith('data:image/')) return null;
	const match = dataUrl.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
	if (!match || !match[2]) return null;
	try {
		const rawFormat = match[1].toLowerCase();
		let type: 'png' | 'jpg' | 'gif' | 'bmp';
		if (rawFormat === 'jpeg' || rawFormat === 'jpg') {
			type = 'jpg';
		} else if (rawFormat === 'png') {
			type = 'png';
		} else if (rawFormat === 'gif') {
			type = 'gif';
		} else if (rawFormat === 'bmp') {
			type = 'bmp';
		} else {
			return null;
		}
		return { buffer: Buffer.from(match[2], 'base64'), type };
	} catch {
		return null;
	}
}

export async function generateMonthlyReportDocx(snapshot: MonthlyReportSnapshot): Promise<Buffer> {
	const primaryColor = cleanHex(snapshot.primaryColor);
	const logoData = parseBase64Image(snapshot.logoDataUrl);

	const thinBorder = {
		style: BorderStyle.SINGLE,
		size: 1,
		color: BORDER_COLOR
	};

	const cellBorders = {
		top: thinBorder,
		bottom: thinBorder,
		left: thinBorder,
		right: thinBorder
	};

	// 1. Header elements
	const headerLeftChildren = logoData
		? [
				new Paragraph({
					children: [
						new ImageRun({
							data: logoData.buffer,
							transformation: { width: 120, height: 40 },
							type: logoData.type
						})
					]
				})
			]
		: [
				new Paragraph({
					children: [
						new TextRun({
							text: snapshot.organizationName || 'Z_Pilot',
							bold: true,
							size: 20,
							font: FONT_FAMILY,
							color: primaryColor
						})
					]
				})
			];

	const headerRightChildren = [
		new Paragraph({
			alignment: AlignmentType.RIGHT,
			children: [
				new TextRun({
					text: snapshot.departmentName || 'Département',
					bold: true,
					size: 18,
					font: FONT_FAMILY,
					color: '555555'
				})
			]
		}),
		new Paragraph({
			alignment: AlignmentType.RIGHT,
			children: [
				new TextRun({
					text: `Rapport d’activité mensuel · ${snapshot.monthLabel}`,
					size: 16,
					font: FONT_FAMILY,
					color: '777777'
				})
			]
		})
	];

	const headerTable = new Table({
		width: { size: 100, type: WidthType.PERCENTAGE },
		borders: {
			top: { style: BorderStyle.NONE },
			bottom: { style: BorderStyle.SINGLE, size: 2, color: primaryColor },
			left: { style: BorderStyle.NONE },
			right: { style: BorderStyle.NONE },
			insideHorizontal: { style: BorderStyle.NONE },
			insideVertical: { style: BorderStyle.NONE }
		},
		rows: [
			new TableRow({
				children: [
					new TableCell({
						width: { size: 50, type: WidthType.PERCENTAGE },
						children: headerLeftChildren
					}),
					new TableCell({
						width: { size: 50, type: WidthType.PERCENTAGE },
						children: headerRightChildren
					})
				]
			})
		]
	});

	// 2. Footer elements
	const generationDateFr = new Date().toLocaleDateString('fr-FR', {
		day: 'numeric',
		month: 'numeric',
		year: 'numeric'
	});

	const footerTable = new Table({
		width: { size: 100, type: WidthType.PERCENTAGE },
		borders: {
			top: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
			bottom: { style: BorderStyle.NONE },
			left: { style: BorderStyle.NONE },
			right: { style: BorderStyle.NONE },
			insideHorizontal: { style: BorderStyle.NONE },
			insideVertical: { style: BorderStyle.NONE }
		},
		rows: [
			new TableRow({
				children: [
					new TableCell({
						width: { size: 70, type: WidthType.PERCENTAGE },
						children: [
							new Paragraph({
								children: [
									new TextRun({
										text: `Rapport mensuel ${snapshot.monthLabel} (v${snapshot.version}) · Généré le ${generationDateFr}`,
										size: 16,
										font: FONT_FAMILY,
										color: '777777'
									})
								]
							})
						]
					}),
					new TableCell({
						width: { size: 30, type: WidthType.PERCENTAGE },
						children: [
							new Paragraph({
								alignment: AlignmentType.RIGHT,
								children: [
									new TextRun({
										text: 'Page ',
										size: 16,
										font: FONT_FAMILY,
										color: '777777'
									}),
									new TextRun({
										children: [PageNumber.CURRENT],
										size: 16,
										font: FONT_FAMILY,
										color: '777777'
									}),
									new TextRun({
										text: ' sur ',
										size: 16,
										font: FONT_FAMILY,
										color: '777777'
									}),
									new TextRun({
										children: [PageNumber.TOTAL_PAGES],
										size: 16,
										font: FONT_FAMILY,
										color: '777777'
									})
								]
							})
						]
					})
				]
			})
		]
	});

	const docChildren: (Paragraph | Table)[] = [];

	// Document Title & Cover Header
	docChildren.push(
		new Paragraph({
			spacing: { before: 200, after: 80 },
			children: [
				new TextRun({
					text: 'RAPPORT D’ACTIVITÉ MENSUEL',
					bold: true,
					size: 36, // 18 pt
					font: FONT_FAMILY,
					color: primaryColor
				})
			]
		}),
		new Paragraph({
			spacing: { before: 0, after: 240 },
			children: [
				new TextRun({
					text: snapshot.monthLabel,
					bold: true,
					size: 26, // 13 pt
					font: FONT_FAMILY,
					color: ZINGANA_GOLD
				})
			]
		})
	);

	// Metadata summary table
	const metaRows = [
		['Organisation', snapshot.organizationName || 'Z_Pilot'],
		['Département', snapshot.departmentName || 'Département'],
		[
			'Période',
			`${snapshot.monthLabel} (${snapshot.weeklyEvolution.weeks.length} semaines consolidées)`
		],
		['Généré par', `${snapshot.generatedBy.fullName} (${snapshot.generatedBy.username})`],
		['Version du document', `Version ${snapshot.version} (instantané figé)`]
	];

	docChildren.push(
		new Table({
			width: { size: 100, type: WidthType.PERCENTAGE },
			borders: {
				top: { style: BorderStyle.NONE },
				bottom: { style: BorderStyle.NONE },
				left: { style: BorderStyle.SINGLE, size: 4, color: primaryColor },
				right: { style: BorderStyle.NONE },
				insideHorizontal: { style: BorderStyle.NONE },
				insideVertical: { style: BorderStyle.NONE }
			},
			rows: metaRows.map(
				([label, val]) =>
					new TableRow({
						children: [
							new TableCell({
								width: { size: 30, type: WidthType.PERCENTAGE },
								shading: { fill: 'F9FAFB', type: ShadingType.CLEAR },
								children: [
									new Paragraph({
										spacing: { before: 40, after: 40 },
										children: [
											new TextRun({
												text: label,
												bold: true,
												size: 18,
												font: FONT_FAMILY,
												color: '4B5563'
											})
										]
									})
								]
							}),
							new TableCell({
								width: { size: 70, type: WidthType.PERCENTAGE },
								shading: { fill: 'F9FAFB', type: ShadingType.CLEAR },
								children: [
									new Paragraph({
										spacing: { before: 40, after: 40 },
										children: [
											new TextRun({
												text: val,
												size: 18,
												font: FONT_FAMILY,
												color: '111827'
											})
										]
									})
								]
							})
						]
					})
			)
		}),
		new Paragraph({ spacing: { before: 240, after: 0 } })
	);

	// Section 1 : Introduction
	docChildren.push(
		new Paragraph({
			heading: HeadingLevel.HEADING_1,
			spacing: { before: 240, after: 120 },
			children: [
				new TextRun({
					text: '1. Introduction & Contexte',
					bold: true,
					size: 26,
					font: FONT_FAMILY,
					color: primaryColor
				})
			]
		}),
		new Paragraph({
			spacing: { before: 60, after: 200 },
			children: [
				new TextRun({
					text: snapshot.introText,
					size: BASE_FONT_SIZE,
					font: FONT_FAMILY
				})
			]
		})
	);

	// Section 2 : Indicateurs clés
	docChildren.push(
		new Paragraph({
			heading: HeadingLevel.HEADING_1,
			spacing: { before: 240, after: 120 },
			children: [
				new TextRun({
					text: '2. Indicateurs clés de performance',
					bold: true,
					size: 26,
					font: FONT_FAMILY,
					color: primaryColor
				})
			]
		})
	);

	const avgPctStr =
		snapshot.keyIndicators.teamAverageProgressPct !== null
			? `${snapshot.keyIndicators.teamAverageProgressPct} %`
			: 'N/A';

	let evolutionDesc = 'Aucun historique précédent';
	if (snapshot.keyIndicators.previousMonthEvolutionPct !== null) {
		const evo = snapshot.keyIndicators.previousMonthEvolutionPct;
		evolutionDesc = `${evo >= 0 ? '+' : ''}${evo} point${Math.abs(evo) > 1 ? 's' : ''} vs mois précédent`;
	}

	// 3-columns key metrics box
	docChildren.push(
		new Table({
			width: { size: 100, type: WidthType.PERCENTAGE },
			borders: {
				top: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
				bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
				left: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
				right: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
				insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
				insideVertical: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR }
			},
			rows: [
				new TableRow({
					children: [
						new TableCell({
							width: { size: 33, type: WidthType.PERCENTAGE },
							shading: { fill: 'F3F4F6', type: ShadingType.CLEAR },
							children: [
								new Paragraph({
									alignment: AlignmentType.CENTER,
									spacing: { before: 80, after: 20 },
									children: [
										new TextRun({
											text: 'Taux moyen d’atteinte',
											bold: true,
											size: 18,
											font: FONT_FAMILY,
											color: '555555'
										})
									]
								}),
								new Paragraph({
									alignment: AlignmentType.CENTER,
									spacing: { before: 0, after: 80 },
									children: [
										new TextRun({
											text: avgPctStr,
											bold: true,
											size: 36,
											font: FONT_FAMILY,
											color: primaryColor
										})
									]
								})
							]
						}),
						new TableCell({
							width: { size: 34, type: WidthType.PERCENTAGE },
							shading: { fill: 'F3F4F6', type: ShadingType.CLEAR },
							children: [
								new Paragraph({
									alignment: AlignmentType.CENTER,
									spacing: { before: 80, after: 20 },
									children: [
										new TextRun({
											text: 'Objectifs réalisés',
											bold: true,
											size: 18,
											font: FONT_FAMILY,
											color: '555555'
										})
									]
								}),
								new Paragraph({
									alignment: AlignmentType.CENTER,
									spacing: { before: 0, after: 80 },
									children: [
										new TextRun({
											text: `${snapshot.keyIndicators.totalTasksCompleted} / ${snapshot.keyIndicators.totalTasksAssigned}`,
											bold: true,
											size: 32,
											font: FONT_FAMILY,
											color: '111827'
										})
									]
								})
							]
						}),
						new TableCell({
							width: { size: 33, type: WidthType.PERCENTAGE },
							shading: { fill: 'F3F4F6', type: ShadingType.CLEAR },
							children: [
								new Paragraph({
									alignment: AlignmentType.CENTER,
									spacing: { before: 80, after: 20 },
									children: [
										new TextRun({
											text: 'Évolution mensuelle',
											bold: true,
											size: 18,
											font: FONT_FAMILY,
											color: '555555'
										})
									]
								}),
								new Paragraph({
									alignment: AlignmentType.CENTER,
									spacing: { before: 0, after: 80 },
									children: [
										new TextRun({
											text: evolutionDesc,
											bold: true,
											size: 24,
											font: FONT_FAMILY,
											color:
												snapshot.keyIndicators.previousMonthEvolutionPct !== null &&
												snapshot.keyIndicators.previousMonthEvolutionPct >= 0
													? primaryColor
													: 'B91C1C'
										})
									]
								})
							]
						})
					]
				})
			]
		}),
		new Paragraph({ spacing: { before: 160, after: 80 } }),
		new Paragraph({
			heading: HeadingLevel.HEADING_2,
			spacing: { before: 160, after: 80 },
			children: [
				new TextRun({
					text: 'Tableau récapitulatif par membre',
					bold: true,
					size: 22,
					font: FONT_FAMILY,
					color: '374151'
				})
			]
		})
	);

	// Members summary table
	const memberHeaderCells = [
		'Collaborateur',
		'Rôle',
		'Tâches assignées',
		'Tâches réalisées',
		'Taux moyen (%)'
	].map(
		(headerText, idx) =>
			new TableCell({
				borders: cellBorders,
				shading: { fill: primaryColor, type: ShadingType.CLEAR },
				children: [
					new Paragraph({
						alignment: idx >= 2 ? AlignmentType.RIGHT : AlignmentType.LEFT,
						children: [
							new TextRun({
								text: headerText,
								bold: true,
								color: 'FFFFFF',
								font: FONT_FAMILY,
								size: 18
							})
						]
					})
				]
			})
	);

	const memberDataRows = snapshot.keyIndicators.membersSummary.map((m, idx) => {
		const isZebra = idx % 2 === 1;
		const fill = isZebra ? ZEBRA_ROW_COLOR : 'FFFFFF';
		const rateStr = m.averageProgressPct !== null ? `${m.averageProgressPct} %` : 'N/A';

		return new TableRow({
			children: [
				new TableCell({
					borders: cellBorders,
					shading: { fill, type: ShadingType.CLEAR },
					children: [
						new Paragraph({
							children: [
								new TextRun({
									text: m.fullName,
									bold: true,
									font: FONT_FAMILY,
									size: 18
								})
							]
						})
					]
				}),
				new TableCell({
					borders: cellBorders,
					shading: { fill, type: ShadingType.CLEAR },
					children: [
						new Paragraph({
							children: [
								new TextRun({
									text: m.isChef ? 'Chef de département' : 'Membre',
									font: FONT_FAMILY,
									size: 18
								})
							]
						})
					]
				}),
				new TableCell({
					borders: cellBorders,
					shading: { fill, type: ShadingType.CLEAR },
					children: [
						new Paragraph({
							alignment: AlignmentType.RIGHT,
							children: [
								new TextRun({
									text: String(m.assignedTasksCount),
									font: FONT_FAMILY,
									size: 18
								})
							]
						})
					]
				}),
				new TableCell({
					borders: cellBorders,
					shading: { fill, type: ShadingType.CLEAR },
					children: [
						new Paragraph({
							alignment: AlignmentType.RIGHT,
							children: [
								new TextRun({
									text: String(m.completedTasksCount),
									font: FONT_FAMILY,
									size: 18
								})
							]
						})
					]
				}),
				new TableCell({
					borders: cellBorders,
					shading: { fill, type: ShadingType.CLEAR },
					children: [
						new Paragraph({
							alignment: AlignmentType.RIGHT,
							children: [
								new TextRun({
									text: rateStr,
									bold: true,
									color: primaryColor,
									font: FONT_FAMILY,
									size: 18
								})
							]
						})
					]
				})
			]
		});
	});

	docChildren.push(
		new Table({
			width: { size: 100, type: WidthType.PERCENTAGE },
			rows: [new TableRow({ children: memberHeaderCells }), ...memberDataRows]
		}),
		new Paragraph({ spacing: { before: 240, after: 0 } })
	);

	// Section 3 : Évolution hebdomadaire (Tableau croisé)
	docChildren.push(
		new Paragraph({
			heading: HeadingLevel.HEADING_1,
			spacing: { before: 240, after: 120 },
			children: [
				new TextRun({
					text: '3. Évolution hebdomadaire',
					bold: true,
					size: 26,
					font: FONT_FAMILY,
					color: primaryColor
				})
			]
		}),
		new Paragraph({
			spacing: { before: 0, after: 160 },
			children: [
				new TextRun({
					text: 'Taux d’atteinte hebdomadaire par collaborateur sur l’ensemble des semaines rattachées au mois :',
					size: BASE_FONT_SIZE,
					font: FONT_FAMILY
				})
			]
		})
	);

	const weeksList = snapshot.weeklyEvolution.weeks;
	const matrixHeaderCells = [
		new TableCell({
			borders: cellBorders,
			shading: { fill: primaryColor, type: ShadingType.CLEAR },
			children: [
				new Paragraph({
					children: [
						new TextRun({
							text: 'Collaborateur',
							bold: true,
							color: 'FFFFFF',
							font: FONT_FAMILY,
							size: 18
						})
					]
				})
			]
		}),
		...weeksList.map(
			(w) =>
				new TableCell({
					borders: cellBorders,
					shading: { fill: primaryColor, type: ShadingType.CLEAR },
					children: [
						new Paragraph({
							alignment: AlignmentType.CENTER,
							children: [
								new TextRun({
									text: `${w.label}\n(${w.periodLabel})`,
									bold: true,
									color: 'FFFFFF',
									font: FONT_FAMILY,
									size: 16
								})
							]
						})
					]
				})
		),
		new TableCell({
			borders: cellBorders,
			shading: { fill: primaryColor, type: ShadingType.CLEAR },
			children: [
				new Paragraph({
					alignment: AlignmentType.RIGHT,
					children: [
						new TextRun({
							text: 'Moyenne',
							bold: true,
							color: 'FFFFFF',
							font: FONT_FAMILY,
							size: 18
						})
					]
				})
			]
		})
	];

	const matrixDataRows = snapshot.weeklyEvolution.matrixRows.map((row, idx) => {
		const isZebra = idx % 2 === 1;
		const fill = isZebra ? ZEBRA_ROW_COLOR : 'FFFFFF';
		const avgStr = row.monthlyAveragePct !== null ? `${row.monthlyAveragePct} %` : 'N/A';

		return new TableRow({
			children: [
				new TableCell({
					borders: cellBorders,
					shading: { fill, type: ShadingType.CLEAR },
					children: [
						new Paragraph({
							children: [
								new TextRun({
									text: row.fullName,
									bold: true,
									font: FONT_FAMILY,
									size: 18
								})
							]
						})
					]
				}),
				...weeksList.map((w) => {
					const val = row.ratesByWeek[w.weekStart];
					const valStr = val !== null && val !== undefined ? `${val} %` : '—';
					return new TableCell({
						borders: cellBorders,
						shading: { fill, type: ShadingType.CLEAR },
						children: [
							new Paragraph({
								alignment: AlignmentType.CENTER,
								children: [
									new TextRun({
										text: valStr,
										font: FONT_FAMILY,
										size: 18
									})
								]
							})
						]
					});
				}),
				new TableCell({
					borders: cellBorders,
					shading: { fill, type: ShadingType.CLEAR },
					children: [
						new Paragraph({
							alignment: AlignmentType.RIGHT,
							children: [
								new TextRun({
									text: avgStr,
									bold: true,
									color: primaryColor,
									font: FONT_FAMILY,
									size: 18
								})
							]
						})
					]
				})
			]
		});
	});

	// Team weekly average bottom row
	const teamWeeklyRow = new TableRow({
		children: [
			new TableCell({
				borders: cellBorders,
				shading: { fill: 'E5E7EB', type: ShadingType.CLEAR },
				children: [
					new Paragraph({
						children: [
							new TextRun({
								text: 'Moyenne équipe',
								bold: true,
								font: FONT_FAMILY,
								size: 18,
								color: '1F2937'
							})
						]
					})
				]
			}),
			...weeksList.map((w) => {
				const teamVal = snapshot.weeklyEvolution.teamWeeklyAverages[w.weekStart];
				const teamValStr = teamVal !== null && teamVal !== undefined ? `${teamVal} %` : '—';
				return new TableCell({
					borders: cellBorders,
					shading: { fill: 'E5E7EB', type: ShadingType.CLEAR },
					children: [
						new Paragraph({
							alignment: AlignmentType.CENTER,
							children: [
								new TextRun({
									text: teamValStr,
									bold: true,
									font: FONT_FAMILY,
									size: 18,
									color: '1F2937'
								})
							]
						})
					]
				});
			}),
			new TableCell({
				borders: cellBorders,
				shading: { fill: 'E5E7EB', type: ShadingType.CLEAR },
				children: [
					new Paragraph({
						alignment: AlignmentType.RIGHT,
						children: [
							new TextRun({
								text: avgPctStr,
								bold: true,
								font: FONT_FAMILY,
								size: 18,
								color: primaryColor
							})
						]
					})
				]
			})
		]
	});

	docChildren.push(
		new Table({
			width: { size: 100, type: WidthType.PERCENTAGE },
			rows: [new TableRow({ children: matrixHeaderCells }), ...matrixDataRows, teamWeeklyRow]
		}),
		new Paragraph({ spacing: { before: 240, after: 0 } })
	);

	// Section 4 : Bilan individuel par membre (chef inclus)
	docChildren.push(
		new Paragraph({
			heading: HeadingLevel.HEADING_1,
			spacing: { before: 240, after: 120 },
			children: [
				new TextRun({
					text: '4. Bilan d’activité par collaborateur',
					bold: true,
					size: 26,
					font: FONT_FAMILY,
					color: primaryColor
				})
			]
		})
	);

	for (const review of snapshot.memberReviews) {
		const roleBadge = review.isChef ? 'Chef de département' : 'Membre';
		docChildren.push(
			new Paragraph({
				heading: HeadingLevel.HEADING_2,
				spacing: { before: 200, after: 80 },
				children: [
					new TextRun({
						text: `${review.fullName} (${roleBadge})`,
						bold: true,
						size: 22,
						font: FONT_FAMILY,
						color: primaryColor
					})
				]
			})
		);

		for (const w of review.weeks) {
			const prog = w.progressPct !== null ? `${w.progressPct} %` : 'N/A';
			docChildren.push(
				new Paragraph({
					spacing: { before: 80, after: 40 },
					children: [
						new TextRun({
							text: `• Semaine ${w.weekNumber} (Progression : ${prog}) : `,
							bold: true,
							font: FONT_FAMILY,
							size: 20,
							color: '374151'
						}),
						new TextRun({
							text: `${w.completedTasks.length} tâche(s) réalisée(s).`,
							font: FONT_FAMILY,
							size: 20
						})
					]
				})
			);

			// List some key completed tasks
			for (const t of w.completedTasks) {
				const notePart = t.note ? ` — Note : « ${t.note} »` : '';
				docChildren.push(
					new Paragraph({
						bullet: { level: 1 },
						spacing: { before: 20, after: 20 },
						children: [
							new TextRun({
								text: `${t.title}${notePart}`,
								font: FONT_FAMILY,
								size: 18,
								color: '4B5563'
							})
						]
					})
				);
			}

			if (w.difficulties && w.difficulties.trim().length > 0) {
				docChildren.push(
					new Paragraph({
						bullet: { level: 1 },
						spacing: { before: 20, after: 20 },
						children: [
							new TextRun({
								text: 'Difficultés : ',
								bold: true,
								font: FONT_FAMILY,
								size: 18,
								color: 'B91C1C'
							}),
							new TextRun({
								text: w.difficulties.trim(),
								italics: true,
								font: FONT_FAMILY,
								size: 18,
								color: '4B5563'
							})
						]
					})
				);
			}

			if (w.chefComment && w.chefComment.trim().length > 0) {
				docChildren.push(
					new Paragraph({
						bullet: { level: 1 },
						spacing: { before: 20, after: 20 },
						children: [
							new TextRun({
								text: 'Commentaire du chef : ',
								bold: true,
								font: FONT_FAMILY,
								size: 18,
								color: ZINGANA_GOLD
							}),
							new TextRun({
								text: w.chefComment.trim(),
								font: FONT_FAMILY,
								size: 18,
								color: '4B5563'
							})
						]
					})
				);
			}
		}
	}

	// Section 5 : Difficultés récurrentes
	docChildren.push(
		new Paragraph({
			heading: HeadingLevel.HEADING_1,
			spacing: { before: 240, after: 120 },
			children: [
				new TextRun({
					text: '5. Difficultés récurrentes et points de blocage',
					bold: true,
					size: 26,
					font: FONT_FAMILY,
					color: primaryColor
				})
			]
		})
	);

	if (snapshot.recurringDifficulties.length === 0) {
		docChildren.push(
			new Paragraph({
				spacing: { before: 60, after: 120 },
				children: [
					new TextRun({
						text: 'Aucune difficulté majeure ou blocage récurrent n’a été signalé au cours du mois.',
						font: FONT_FAMILY,
						italics: true,
						size: BASE_FONT_SIZE,
						color: '555555'
					})
				]
			})
		);
	} else {
		for (const diff of snapshot.recurringDifficulties) {
			docChildren.push(
				new Paragraph({
					bullet: { level: 0 },
					spacing: { before: 40, after: 40 },
					children: [
						new TextRun({
							text: diff,
							font: FONT_FAMILY,
							size: BASE_FONT_SIZE,
							color: '1F2937'
						})
					]
				})
			);
		}
	}

	// Section 6 : Perspectives
	docChildren.push(
		new Paragraph({
			heading: HeadingLevel.HEADING_1,
			spacing: { before: 240, after: 120 },
			children: [
				new TextRun({
					text: '6. Perspectives et axes prioritaires',
					bold: true,
					size: 26,
					font: FONT_FAMILY,
					color: primaryColor
				})
			]
		})
	);

	if (snapshot.perspectives.length === 0) {
		docChildren.push(
			new Paragraph({
				spacing: { before: 60, after: 120 },
				children: [
					new TextRun({
						text: 'Poursuite des chantiers réguliers et consolidation des objectifs opérationnels pour le mois suivant.',
						font: FONT_FAMILY,
						size: BASE_FONT_SIZE
					})
				]
			})
		);
	} else {
		for (const persp of snapshot.perspectives) {
			docChildren.push(
				new Paragraph({
					bullet: { level: 0 },
					spacing: { before: 40, after: 40 },
					children: [
						new TextRun({
							text: persp,
							font: FONT_FAMILY,
							size: BASE_FONT_SIZE,
							color: '1F2937'
						})
					]
				})
			);
		}
	}

	// Section 7 : Conclusion
	docChildren.push(
		new Paragraph({
			heading: HeadingLevel.HEADING_1,
			spacing: { before: 240, after: 120 },
			children: [
				new TextRun({
					text: '7. Conclusion du responsable',
					bold: true,
					size: 26,
					font: FONT_FAMILY,
					color: primaryColor
				})
			]
		}),
		new Paragraph({
			spacing: { before: 60, after: 240 },
			children: [
				new TextRun({
					text: snapshot.conclusionText,
					size: BASE_FONT_SIZE,
					font: FONT_FAMILY
				})
			]
		})
	);

	// Annexe : Liste des rapports hebdomadaires pris en compte
	docChildren.push(
		new Paragraph({
			heading: HeadingLevel.HEADING_1,
			spacing: { before: 240, after: 120 },
			children: [
				new TextRun({
					text: 'Annexe — Rapports hebdomadaires consolidés',
					bold: true,
					size: 26,
					font: FONT_FAMILY,
					color: primaryColor
				})
			]
		}),
		new Paragraph({
			spacing: { before: 0, after: 120 },
			children: [
				new TextRun({
					text: 'Traçabilité des rapports validés et publiés intégrés dans le calcul de cet instantané mensuel :',
					size: 18,
					font: FONT_FAMILY,
					color: '555555'
				})
			]
		})
	);

	const annexHeaders = ['Semaine', 'Collaborateur', 'Version', 'Date de publication'].map(
		(hText) =>
			new TableCell({
				borders: cellBorders,
				shading: { fill: primaryColor, type: ShadingType.CLEAR },
				children: [
					new Paragraph({
						children: [
							new TextRun({
								text: hText,
								bold: true,
								color: 'FFFFFF',
								font: FONT_FAMILY,
								size: 18
							})
						]
					})
				]
			})
	);

	const annexRows = snapshot.annexReports.map((r, idx) => {
		const isZebra = idx % 2 === 1;
		const fill = isZebra ? ZEBRA_ROW_COLOR : 'FFFFFF';
		const datePub = new Date(r.publishedAt).toLocaleDateString('fr-FR', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});

		return new TableRow({
			children: [
				new TableCell({
					borders: cellBorders,
					shading: { fill, type: ShadingType.CLEAR },
					children: [
						new Paragraph({
							children: [
								new TextRun({
									text: `Semaine ${r.weekNumber}`,
									bold: true,
									font: FONT_FAMILY,
									size: 18
								})
							]
						})
					]
				}),
				new TableCell({
					borders: cellBorders,
					shading: { fill, type: ShadingType.CLEAR },
					children: [
						new Paragraph({
							children: [
								new TextRun({
									text: r.memberName,
									font: FONT_FAMILY,
									size: 18
								})
							]
						})
					]
				}),
				new TableCell({
					borders: cellBorders,
					shading: { fill, type: ShadingType.CLEAR },
					children: [
						new Paragraph({
							children: [
								new TextRun({
									text: `v${r.version}`,
									font: FONT_FAMILY,
									size: 18
								})
							]
						})
					]
				}),
				new TableCell({
					borders: cellBorders,
					shading: { fill, type: ShadingType.CLEAR },
					children: [
						new Paragraph({
							children: [
								new TextRun({
									text: datePub,
									font: FONT_FAMILY,
									size: 18
								})
							]
						})
					]
				})
			]
		});
	});

	docChildren.push(
		new Table({
			width: { size: 100, type: WidthType.PERCENTAGE },
			rows: [new TableRow({ children: annexHeaders }), ...annexRows]
		})
	);

	// Construct Document
	const doc = new Document({
		sections: [
			{
				properties: {
					page: {
						margin: {
							top: 1134, // 2 cm in twips (1 cm = 567 twips)
							bottom: 1134,
							left: 1134,
							right: 1134
						}
					}
				},
				headers: {
					default: new Header({
						children: [headerTable]
					})
				},
				footers: {
					default: new Footer({
						children: [footerTable]
					})
				},
				children: docChildren
			}
		]
	});

	return Packer.toBuffer(doc);
}
