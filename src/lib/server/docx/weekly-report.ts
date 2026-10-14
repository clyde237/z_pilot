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
import type { WeeklyReportSnapshot } from '#lib/domain/reports.js';
import { TASK_WEIGHT_LABELS } from '#lib/domain/tasks.js';

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

function parseBase64Image(dataUrl?: string | null): { buffer: Buffer; type: 'png' | 'jpg' } | null {
	if (!dataUrl || !dataUrl.startsWith('data:image/')) return null;
	const match = dataUrl.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
	if (!match || !match[2]) return null;
	try {
		const type = match[1] === 'jpeg' || match[1] === 'jpg' ? 'jpg' : 'png';
		return { buffer: Buffer.from(match[2], 'base64'), type };
	} catch {
		return null;
	}
}

export async function generateWeeklyReportDocx(snapshot: WeeklyReportSnapshot): Promise<Buffer> {
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
					text: 'Rapport d’activité hebdomadaire',
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

	// 2. Footer
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
										text: `Rapport hebdomadaire · ${snapshot.member.fullName} · ${snapshot.weekLabel}`,
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
										text: ' / ',
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

	// 3. Document body paragraphs and sections
	const bodyChildren: (Paragraph | Table)[] = [];

	// Document Title
	bodyChildren.push(
		new Paragraph({
			spacing: { before: 240, after: 120 },
			children: [
				new TextRun({
					text: 'RAPPORT D’ACTIVITÉ HEBDOMADAIRE',
					bold: true,
					size: 32, // 16 pt
					font: FONT_FAMILY,
					color: primaryColor
				})
			]
		}),
		new Paragraph({
			spacing: { after: 240 },
			children: [
				new TextRun({
					text: `${snapshot.member.fullName}  |  ${snapshot.weekLabel}`,
					bold: true,
					size: 24, // 12 pt
					font: FONT_FAMILY,
					color: '333333'
				})
			]
		})
	);

	// Metadata Box
	const publishedDateFr = new Date(snapshot.publishedAt).toLocaleDateString('fr-FR', {
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	});

	bodyChildren.push(
		new Table({
			width: { size: 100, type: WidthType.PERCENTAGE },
			borders: cellBorders,
			rows: [
				new TableRow({
					children: [
						new TableCell({
							shading: { fill: ZEBRA_ROW_COLOR, type: ShadingType.CLEAR },
							children: [
								new Paragraph({
									children: [
										new TextRun({
											text: `Publié le : ${publishedDateFr}   ·   Par : ${snapshot.publishedBy.fullName}   ·   Version : v${snapshot.version}`,
											size: 18,
											font: FONT_FAMILY,
											color: '555555'
										})
									]
								})
							]
						})
					]
				})
			]
		}),
		new Paragraph({ spacing: { after: 360 } })
	);

	// Section 1: Synthèse des objectifs
	const progressText =
		snapshot.progression.progressPct !== null
			? `${snapshot.progression.progressPct} %`
			: 'Aucun objectif défini';

	bodyChildren.push(
		new Paragraph({
			heading: HeadingLevel.HEADING_1,
			spacing: { before: 240, after: 120 },
			children: [
				new TextRun({
					text: '1. Synthèse des objectifs',
					bold: true,
					size: 26,
					font: FONT_FAMILY,
					color: primaryColor
				})
			]
		}),
		new Table({
			width: { size: 100, type: WidthType.PERCENTAGE },
			borders: cellBorders,
			rows: [
				new TableRow({
					children: [
						new TableCell({
							width: { size: 35, type: WidthType.PERCENTAGE },
							shading: { fill: 'FFF9E6', type: ShadingType.CLEAR },
							children: [
								new Paragraph({
									alignment: AlignmentType.CENTER,
									children: [
										new TextRun({
											text: progressText,
											bold: true,
											size: 36,
											font: FONT_FAMILY,
											color: ZINGANA_GOLD
										})
									]
								}),
								new Paragraph({
									alignment: AlignmentType.CENTER,
									children: [
										new TextRun({
											text: 'Taux d’atteinte hebdomadaire',
											size: 16,
											font: FONT_FAMILY,
											color: '777777'
										})
									]
								})
							]
						}),
						new TableCell({
							width: { size: 65, type: WidthType.PERCENTAGE },
							children: [
								new Paragraph({
									children: [
										new TextRun({
											text: `• Tâches terminées : `,
											bold: true,
											size: BASE_FONT_SIZE,
											font: FONT_FAMILY
										}),
										new TextRun({
											text: `${snapshot.progression.completedTasksCount} sur ${snapshot.progression.totalTasksCount} assignée(s)`,
											size: BASE_FONT_SIZE,
											font: FONT_FAMILY
										})
									]
								}),
								new Paragraph({
									children: [
										new TextRun({
											text: `• Points obtenus : `,
											bold: true,
											size: BASE_FONT_SIZE,
											font: FONT_FAMILY
										}),
										new TextRun({
											text: `${snapshot.progression.achievedWeight} sur ${snapshot.progression.totalWeight} points pondérés`,
											size: BASE_FONT_SIZE,
											font: FONT_FAMILY
										})
									]
								})
							]
						})
					]
				})
			]
		}),
		new Paragraph({ spacing: { after: 360 } })
	);

	// Section 2: Activités réalisées
	bodyChildren.push(
		new Paragraph({
			heading: HeadingLevel.HEADING_1,
			spacing: { before: 240, after: 120 },
			children: [
				new TextRun({
					text: '2. Activités réalisées (par jour)',
					bold: true,
					size: 26,
					font: FONT_FAMILY,
					color: primaryColor
				})
			]
		})
	);

	if (snapshot.completedTasksByDay.length === 0) {
		bodyChildren.push(
			new Paragraph({
				children: [
					new TextRun({
						text: 'Aucune tâche n’a été validée cette semaine.',
						italics: true,
						size: BASE_FONT_SIZE,
						font: FONT_FAMILY,
						color: '666666'
					})
				]
			})
		);
	} else {
		for (const dayGroup of snapshot.completedTasksByDay) {
			const dateFr = new Date(dayGroup.date).toLocaleDateString('fr-FR', {
				day: 'numeric',
				month: 'long'
			});

			bodyChildren.push(
				new Paragraph({
					heading: HeadingLevel.HEADING_2,
					spacing: { before: 180, after: 80 },
					children: [
						new TextRun({
							text: `${dayGroup.dayName} (${dateFr})`,
							bold: true,
							size: 22,
							font: FONT_FAMILY,
							color: '222222'
						})
					]
				})
			);

			const tableRows: TableRow[] = [
				new TableRow({
					tableHeader: true,
					children: [
						new TableCell({
							width: { size: 60, type: WidthType.PERCENTAGE },
							shading: { fill: primaryColor, type: ShadingType.CLEAR },
							children: [
								new Paragraph({
									children: [
										new TextRun({
											text: 'Tâche réalisée',
											bold: true,
											size: 18,
											font: FONT_FAMILY,
											color: 'FFFFFF'
										})
									]
								})
							]
						}),
						new TableCell({
							width: { size: 15, type: WidthType.PERCENTAGE },
							shading: { fill: primaryColor, type: ShadingType.CLEAR },
							children: [
								new Paragraph({
									alignment: AlignmentType.CENTER,
									children: [
										new TextRun({
											text: 'Poids',
											bold: true,
											size: 18,
											font: FONT_FAMILY,
											color: 'FFFFFF'
										})
									]
								})
							]
						}),
						new TableCell({
							width: { size: 25, type: WidthType.PERCENTAGE },
							shading: { fill: primaryColor, type: ShadingType.CLEAR },
							children: [
								new Paragraph({
									children: [
										new TextRun({
											text: 'Notes du membre',
											bold: true,
											size: 18,
											font: FONT_FAMILY,
											color: 'FFFFFF'
										})
									]
								})
							]
						})
					]
				})
			];

			dayGroup.tasks.forEach((task, idx) => {
				const isEven = idx % 2 === 1;
				tableRows.push(
					new TableRow({
						children: [
							new TableCell({
								borders: cellBorders,
								shading: isEven ? { fill: ZEBRA_ROW_COLOR, type: ShadingType.CLEAR } : undefined,
								children: [
									new Paragraph({
										children: [
											new TextRun({
												text: task.title,
												bold: true,
												size: BASE_FONT_SIZE,
												font: FONT_FAMILY
											}),
											...(task.isQuantitative
												? [
														new TextRun({
															text: ` (${task.achievedValue ?? 0}/${task.targetValue} ${task.unit ?? ''})`,
															size: 18,
															font: FONT_FAMILY,
															color: '666666'
														})
													]
												: [])
										]
									}),
									...(task.description
										? [
												new Paragraph({
													children: [
														new TextRun({
															text: task.description,
															size: 18,
															font: FONT_FAMILY,
															color: '666666'
														})
													]
												})
											]
										: [])
								]
							}),
							new TableCell({
								borders: cellBorders,
								shading: isEven ? { fill: ZEBRA_ROW_COLOR, type: ShadingType.CLEAR } : undefined,
								children: [
									new Paragraph({
										alignment: AlignmentType.CENTER,
										children: [
											new TextRun({
												text: TASK_WEIGHT_LABELS[task.weight]?.shortLabel ?? `Poids ${task.weight}`,
												size: 18,
												font: FONT_FAMILY
											})
										]
									})
								]
							}),
							new TableCell({
								borders: cellBorders,
								shading: isEven ? { fill: ZEBRA_ROW_COLOR, type: ShadingType.CLEAR } : undefined,
								children: [
									new Paragraph({
										children: [
											new TextRun({
												text: task.note || '—',
												italics: !task.note,
												size: 18,
												font: FONT_FAMILY,
												color: task.note ? '222222' : '888888'
											})
										]
									})
								]
							})
						]
					})
				);
			});

			bodyChildren.push(
				new Table({
					width: { size: 100, type: WidthType.PERCENTAGE },
					borders: cellBorders,
					rows: tableRows
				})
			);
		}
	}

	bodyChildren.push(new Paragraph({ spacing: { after: 360 } }));

	// Section 3: Tâches non réalisées ou partielles
	bodyChildren.push(
		new Paragraph({
			heading: HeadingLevel.HEADING_1,
			spacing: { before: 240, after: 120 },
			children: [
				new TextRun({
					text: '3. Tâches non réalisées ou partielles',
					bold: true,
					size: 26,
					font: FONT_FAMILY,
					color: primaryColor
				})
			]
		})
	);

	if (snapshot.uncompletedOrPartialTasks.length === 0) {
		bodyChildren.push(
			new Paragraph({
				children: [
					new TextRun({
						text: 'Toutes les tâches prévues pour cette semaine ont été réalisées à 100 %.',
						size: BASE_FONT_SIZE,
						font: FONT_FAMILY,
						color: primaryColor
					})
				]
			})
		);
	} else {
		const uncompletedRows: TableRow[] = [
			new TableRow({
				tableHeader: true,
				children: [
					new TableCell({
						width: { size: 50, type: WidthType.PERCENTAGE },
						shading: { fill: '4A5568', type: ShadingType.CLEAR },
						children: [
							new Paragraph({
								children: [
									new TextRun({
										text: 'Tâche non terminée',
										bold: true,
										size: 18,
										font: FONT_FAMILY,
										color: 'FFFFFF'
									})
								]
							})
						]
					}),
					new TableCell({
						width: { size: 20, type: WidthType.PERCENTAGE },
						shading: { fill: '4A5568', type: ShadingType.CLEAR },
						children: [
							new Paragraph({
								alignment: AlignmentType.CENTER,
								children: [
									new TextRun({
										text: 'Avancement',
										bold: true,
										size: 18,
										font: FONT_FAMILY,
										color: 'FFFFFF'
									})
								]
							})
						]
					}),
					new TableCell({
						width: { size: 30, type: WidthType.PERCENTAGE },
						shading: { fill: '4A5568', type: ShadingType.CLEAR },
						children: [
							new Paragraph({
								children: [
									new TextRun({
										text: 'Note explicative',
										bold: true,
										size: 18,
										font: FONT_FAMILY,
										color: 'FFFFFF'
									})
								]
							})
						]
					})
				]
			})
		];

		snapshot.uncompletedOrPartialTasks.forEach((task, idx) => {
			const isEven = idx % 2 === 1;
			const progLabel = task.isQuantitative
				? `${task.achievedValue ?? 0} / ${task.targetValue} ${task.unit ?? ''}`
				: 'Non réalisée';

			uncompletedRows.push(
				new TableRow({
					children: [
						new TableCell({
							borders: cellBorders,
							shading: isEven ? { fill: ZEBRA_ROW_COLOR, type: ShadingType.CLEAR } : undefined,
							children: [
								new Paragraph({
									children: [
										new TextRun({
											text: task.title,
											bold: true,
											size: BASE_FONT_SIZE,
											font: FONT_FAMILY
										})
									]
								})
							]
						}),
						new TableCell({
							borders: cellBorders,
							shading: isEven ? { fill: ZEBRA_ROW_COLOR, type: ShadingType.CLEAR } : undefined,
							children: [
								new Paragraph({
									alignment: AlignmentType.CENTER,
									children: [
										new TextRun({
											text: progLabel,
											size: 18,
											font: FONT_FAMILY,
											color: 'C53030'
										})
									]
								})
							]
						}),
						new TableCell({
							borders: cellBorders,
							shading: isEven ? { fill: ZEBRA_ROW_COLOR, type: ShadingType.CLEAR } : undefined,
							children: [
								new Paragraph({
									children: [
										new TextRun({
											text: task.note || '—',
											italics: !task.note,
											size: 18,
											font: FONT_FAMILY,
											color: task.note ? '222222' : '888888'
										})
									]
								})
							]
						})
					]
				})
			);
		});

		bodyChildren.push(
			new Table({
				width: { size: 100, type: WidthType.PERCENTAGE },
				borders: cellBorders,
				rows: uncompletedRows
			})
		);
	}

	bodyChildren.push(new Paragraph({ spacing: { after: 360 } }));

	// Section 4: Difficultés rencontrées
	bodyChildren.push(
		new Paragraph({
			heading: HeadingLevel.HEADING_1,
			spacing: { before: 240, after: 120 },
			children: [
				new TextRun({
					text: '4. Difficultés rencontrées',
					bold: true,
					size: 26,
					font: FONT_FAMILY,
					color: primaryColor
				})
			]
		}),
		new Paragraph({
			spacing: { after: 240 },
			children: [
				new TextRun({
					text: snapshot.difficulties || 'Aucune difficulté particulière signalée cette semaine.',
					italics: !snapshot.difficulties,
					size: BASE_FONT_SIZE,
					font: FONT_FAMILY,
					color: snapshot.difficulties ? '222222' : '666666'
				})
			]
		})
	);

	// Section 5: Commentaire du chef
	bodyChildren.push(
		new Paragraph({
			heading: HeadingLevel.HEADING_1,
			spacing: { before: 240, after: 120 },
			children: [
				new TextRun({
					text: '5. Commentaire du chef de département',
					bold: true,
					size: 26,
					font: FONT_FAMILY,
					color: primaryColor
				})
			]
		}),
		new Paragraph({
			spacing: { after: 240 },
			children: [
				new TextRun({
					text: snapshot.chefComment || 'Aucun commentaire particulier.',
					italics: !snapshot.chefComment,
					size: BASE_FONT_SIZE,
					font: FONT_FAMILY,
					color: snapshot.chefComment ? '222222' : '666666'
				})
			]
		})
	);

	// Section 6: Plan de la semaine suivante
	bodyChildren.push(
		new Paragraph({
			heading: HeadingLevel.HEADING_1,
			spacing: { before: 240, after: 120 },
			children: [
				new TextRun({
					text: '6. Plan de la semaine suivante',
					bold: true,
					size: 26,
					font: FONT_FAMILY,
					color: primaryColor
				})
			]
		})
	);

	if (snapshot.nextWeekPlan.plannedTasks.length > 0) {
		const nextWeekRows: TableRow[] = [
			new TableRow({
				tableHeader: true,
				children: [
					new TableCell({
						width: { size: 75, type: WidthType.PERCENTAGE },
						shading: { fill: primaryColor, type: ShadingType.CLEAR },
						children: [
							new Paragraph({
								children: [
									new TextRun({
										text: 'Tâche programmée',
										bold: true,
										size: 18,
										font: FONT_FAMILY,
										color: 'FFFFFF'
									})
								]
							})
						]
					}),
					new TableCell({
						width: { size: 25, type: WidthType.PERCENTAGE },
						shading: { fill: primaryColor, type: ShadingType.CLEAR },
						children: [
							new Paragraph({
								alignment: AlignmentType.CENTER,
								children: [
									new TextRun({
										text: 'Poids',
										bold: true,
										size: 18,
										font: FONT_FAMILY,
										color: 'FFFFFF'
									})
								]
							})
						]
					})
				]
			})
		];

		snapshot.nextWeekPlan.plannedTasks.forEach((t, idx) => {
			const isEven = idx % 2 === 1;
			nextWeekRows.push(
				new TableRow({
					children: [
						new TableCell({
							borders: cellBorders,
							shading: isEven ? { fill: ZEBRA_ROW_COLOR, type: ShadingType.CLEAR } : undefined,
							children: [
								new Paragraph({
									children: [
										new TextRun({
											text: t.title,
											size: BASE_FONT_SIZE,
											font: FONT_FAMILY
										})
									]
								})
							]
						}),
						new TableCell({
							borders: cellBorders,
							shading: isEven ? { fill: ZEBRA_ROW_COLOR, type: ShadingType.CLEAR } : undefined,
							children: [
								new Paragraph({
									alignment: AlignmentType.CENTER,
									children: [
										new TextRun({
											text: TASK_WEIGHT_LABELS[t.weight]?.shortLabel ?? `Poids ${t.weight}`,
											size: 18,
											font: FONT_FAMILY
										})
									]
								})
							]
						})
					]
				})
			);
		});

		bodyChildren.push(
			new Table({
				width: { size: 100, type: WidthType.PERCENTAGE },
				borders: cellBorders,
				rows: nextWeekRows
			}),
			new Paragraph({ spacing: { after: 180 } })
		);
	}

	if (snapshot.nextWeekPlan.customText) {
		bodyChildren.push(
			new Paragraph({
				children: [
					new TextRun({
						text: snapshot.nextWeekPlan.customText,
						size: BASE_FONT_SIZE,
						font: FONT_FAMILY
					})
				]
			})
		);
	} else if (snapshot.nextWeekPlan.plannedTasks.length === 0) {
		bodyChildren.push(
			new Paragraph({
				children: [
					new TextRun({
						text: 'Aucune tâche ni instruction spécifique planifiée pour le moment.',
						italics: true,
						size: BASE_FONT_SIZE,
						font: FONT_FAMILY,
						color: '666666'
					})
				]
			})
		);
	}

	// 4. Assemble document
	const doc = new Document({
		sections: [
			{
				properties: {
					page: {
						margin: {
							top: 1134, // 2 cm
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
				children: bodyChildren
			}
		]
	});

	return Packer.toBuffer(doc);
}
