
import React from 'react';
import { MediaFile } from '../types';

interface FileSelectorProps {
  onImagesSelected: (files: File[]) => void;
  onAudioSelected: (file: File) => void;
}

const FileSelector: React.FC<FileSelectorProps> = ({ onImagesSelected, onAudioSelected }) => {
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      onImagesSelected(Array.from(e.target.files));
    }
  };

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onAudioSelected(e.target.files[0]);
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 mb-8">
      <div className="flex-1">
        <label className="block text-sm font-medium text-slate-400 mb-2">Select Images (Multiple)</label>
        <div className="relative group">
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleImageChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
          <div className="border-2 border-dashed border-slate-700 group-hover:border-blue-500 rounded-xl p-8 text-center transition-all bg-slate-800/50">
            <svg className="w-10 h-10 text-slate-500 group-hover:text-blue-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-slate-300 font-medium">Click to upload photos</p>
            <p className="text-xs text-slate-500 mt-1">PNG, JPG, WebP supported</p>
          </div>
        </div>
      </div>

      <div className="flex-1">
        <label className="block text-sm font-medium text-slate-400 mb-2">Select Background Music (MP3)</label>
        <div className="relative group">
          <input
            type="file"
            accept="audio/mp3,audio/mpeg"
            onChange={handleAudioChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
          <div className="border-2 border-dashed border-slate-700 group-hover:border-emerald-500 rounded-xl p-8 text-center transition-all bg-slate-800/50">
            <svg className="w-10 h-10 text-slate-500 group-hover:text-emerald-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            <p className="text-slate-300 font-medium">Click to upload audio</p>
            <p className="text-xs text-slate-500 mt-1">MP3 format recommended</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileSelector;
