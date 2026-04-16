"use client";

import { useState } from "react";
import { UploadCloud, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function ImportTimetablePage() {
    const [isDragging, setIsDragging] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [result, setResult] = useState<any>(null);

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setIsDragging(true);
        } else if (e.type === "dragleave") {
            setIsDragging(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const droppedFile = e.dataTransfer.files[0];
            if (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls')) {
                setFile(droppedFile);
                setResult(null);
            } else {
                toast.error("Please upload a valid Excel file (.xlsx)");
            }
        }
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setResult(null);
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await fetch("/api/admin/import", {
                method: "POST",
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to import timetable");
            }

            setResult(data.stats);
            toast.success(data.message);
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative mt-16 md:mt-0">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">Import Timetable</h1>
                <p className="text-muted-foreground mt-2">
                    Bulk upload scheduling data from your school's official Excel format.
                </p>
            </div>

            <Card className="border-secondary/20 shadow-xl shadow-primary/5 bg-card/50 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5 text-primary" />
                        Excel Uploader
                    </CardTitle>
                    <CardDescription>
                        Only .xlsx files are supported. Ensure your sheets are named MON, TUE, WED, etc.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div
                        className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-all ${
                            isDragging 
                                ? "border-primary bg-primary/5 scale-[1.02]" 
                                : "border-secondary hover:border-primary/50 hover:bg-secondary/10"
                        }`}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                    >
                        <input
                            type="file"
                            accept=".xlsx, .xls"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            onChange={handleFileInput}
                            disabled={isUploading}
                        />

                        <div className="flex flex-col items-center justify-center gap-4 pointer-events-none">
                            {file ? (
                                <div className="p-4 bg-primary/10 rounded-full">
                                    <FileSpreadsheet className="w-10 h-10 text-primary" />
                                </div>
                            ) : (
                                <div className="p-4 bg-secondary rounded-full text-muted-foreground/50">
                                    <UploadCloud className="w-10 h-10" />
                                </div>
                            )}

                            <div>
                                {file ? (
                                    <p className="text-lg font-medium text-foreground">{file.name}</p>
                                ) : (
                                    <>
                                        <p className="text-lg font-medium text-foreground">
                                            Drag & Drop your Excel file here
                                        </p>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            or click to browse from your computer
                                        </p>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end pt-4">
                        <Button 
                            size="lg" 
                            disabled={!file || isUploading} 
                            onClick={handleUpload}
                            className="w-full md:w-auto"
                        >
                            {isUploading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Analyzing Data...
                                </>
                            ) : (
                                "Process Timetable"
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {result && (
                <Card className="border-green-500/20 shadow-xl shadow-green-500/5 bg-green-500/5">
                    <CardHeader>
                        <CardTitle className="text-green-700 flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5" />
                            Dry Run Successful
                        </CardTitle>
                        <CardDescription className="text-green-600/80">
                            The timetable data has been successfully imported and persisted to the database.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-3 gap-6">
                            <div className="space-y-1">
                                <p className="text-sm text-green-700/80 font-medium">New Teachers Found</p>
                                <p className="text-3xl font-bold text-green-700">{result.teachersCount}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm text-green-700/80 font-medium">Unique Entities (Classes)</p>
                                <p className="text-3xl font-bold text-green-700">{result.classesCount}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm text-green-700/80 font-medium">Total Periods Parsed</p>
                                <p className="text-3xl font-bold text-green-700">{result.periodsCount}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
