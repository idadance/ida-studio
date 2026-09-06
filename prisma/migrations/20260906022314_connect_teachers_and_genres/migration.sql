-- CreateTable
CREATE TABLE "_GenreToTeacher" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_GenreToTeacher_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_GenreToTeacher_B_index" ON "_GenreToTeacher"("B");

-- AddForeignKey
ALTER TABLE "_GenreToTeacher" ADD CONSTRAINT "_GenreToTeacher_A_fkey" FOREIGN KEY ("A") REFERENCES "Genre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GenreToTeacher" ADD CONSTRAINT "_GenreToTeacher_B_fkey" FOREIGN KEY ("B") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
